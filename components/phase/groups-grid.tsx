'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle, RefreshCw } from 'lucide-react'

import { resetDraw } from '@/lib/actions/phases'
import type { GroupWithTeams } from '@/lib/queries/phases'
import {
  TIER_LABELS,
  TIER_BADGE_CLASSES,
  sortTiers,
  type Tier,
} from '@/lib/tiers'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface GroupsGridProps {
  phaseId: string
  groups: GroupWithTeams[]
  matchesCount: number
  canReset: boolean
  // Equipas do torneio (com escalão) para agrupar os grupos por escalão.
  teams: { id: string; tier: Tier }[]
  // Torneio multi-escalão: os grupos são mostrados numa linha por escalão.
  multiTier: boolean
}

export function GroupsGrid({
  phaseId,
  groups,
  matchesCount,
  canReset,
  teams,
  multiTier,
}: GroupsGridProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmReset, setConfirmReset] = useState(false)

  function handleReset() {
    startTransition(async () => {
      const result = await resetDraw(phaseId)
      if (result.success) {
        toast.success('Sorteio refeito. Configura um novo sorteio.')
        setConfirmReset(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  // Escalão de cada grupo, inferido das equipas que contém (um grupo só tem
  // equipas de um escalão). Os grupos são depois agrupados por escalão para
  // serem mostrados numa linha cada, pela ordem de TIER_ORDER.
  const tierByTeamId = new Map(teams.map((t) => [t.id, t.tier]))
  function groupTier(group: GroupWithTeams): Tier | null {
    for (const team of group.teams) {
      const tier = tierByTeamId.get(team.id)
      if (tier) return tier
    }
    return null
  }

  const byTier = new Map<Tier, GroupWithTeams[]>()
  const untiered: GroupWithTeams[] = []
  for (const group of groups) {
    const tier = groupTier(group)
    if (tier == null) {
      untiered.push(group)
      continue
    }
    if (!byTier.has(tier)) byTier.set(tier, [])
    byTier.get(tier)!.push(group)
  }
  const tierSections = sortTiers([...byTier.keys()]).map((tier) => ({
    tier,
    groups: byTier.get(tier)!,
  }))

  return (
    <div className="flex flex-col gap-4 border-t border-border p-4">
      {multiTier && tierSections.length > 0 ? (
        <div className="flex flex-col gap-5">
          {tierSections.map(({ tier, groups: tierGroups }) => (
            <div key={tier} className="flex flex-col gap-2">
              <Badge className={`w-fit ${TIER_BADGE_CLASSES[tier]}`}>
                {TIER_LABELS[tier]}
              </Badge>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tierGroups.map((group) => (
                  <GroupCard key={group.id} group={group} tier={tier} />
                ))}
              </div>
            </div>
          ))}
          {untiered.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {untiered.map((group) => (
                <GroupCard key={group.id} group={group} tier={null} />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} tier={null} />
          ))}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle className="size-3.5 text-success" />
        {matchesCount} jogo(s) gerado(s) automaticamente
      </p>

      {canReset ? (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmReset(true)}
            data-testid="reset-draw"
          >
            <RefreshCw className="size-3.5" />
            Refazer sorteio
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Já há jogos iniciados nesta fase — o sorteio não pode ser refeito.
        </p>
      )}

      {/* AlertDialog de confirmação do reset */}
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refazer sorteio</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acção apaga os grupos e todos os jogos gerados desta fase para
              que possas voltar a sortear. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleReset()
              }}
              disabled={isPending}
              className="bg-danger text-white hover:bg-danger/90"
            >
              Refazer sorteio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function GroupCard({
  group,
  tier,
}: {
  group: GroupWithTeams
  tier: Tier | null
}) {
  // Em multi-escalão o escalão já é o cabeçalho da linha, por isso remove-se o
  // prefixo redundante do nome ("Seniores — Grupo A" → "Grupo A").
  const prefix = tier ? `${TIER_LABELS[tier]} — ` : ''
  const name =
    prefix && group.name.startsWith(prefix)
      ? group.name.slice(prefix.length)
      : group.name

  return (
    <div
      data-testid="group-card"
      className="rounded-md border border-border bg-surface-2 p-3"
    >
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {name}
      </p>
      <div className="flex flex-col gap-1.5">
        {group.teams.map((team) => {
          const initials = team.short_name ?? team.name.slice(0, 2).toUpperCase()
          return (
            <div key={team.id} className="flex items-center gap-2">
              <div
                className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded border border-border text-[10px] font-medium"
                style={{
                  background: team.color_primary,
                  color: team.color_secondary,
                }}
              >
                {initials}
              </div>
              <span className="text-sm">{team.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
