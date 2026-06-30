'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import {
  GripVertical,
  Grid3x3,
  GitMerge,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'

import { deletePhase } from '@/lib/actions/phases'
import type { PhaseWithGroups } from '@/lib/queries/phases'
import type { Team as DrawTeam } from '@/lib/draw'
import type { Tier } from '@/lib/tiers'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { PhaseDialog } from '@/components/phase/phase-dialog'
import { DrawPanel } from '@/components/phase/draw-panel'
import { GroupsGrid } from '@/components/phase/groups-grid'
import { KnockoutSection } from '@/components/bracket/knockout-section'

interface PhaseCardProps {
  phase: PhaseWithGroups
  tournamentId: string
  isAdmin: boolean
  teams: (DrawTeam & { tier: Tier })[]
  multiTier?: boolean
}

// Etiqueta de estado da fase, derivada dos grupos e dos jogos.
function phaseStatus(phase: PhaseWithGroups): { label: string; className: string } {
  if (phase.type === 'knockout') {
    return { label: 'Eliminatórias', className: 'bg-surface-2 text-muted-foreground' }
  }
  if (phase.groups.length === 0) {
    return { label: 'Sorteio pendente', className: 'bg-warning-bg text-warning' }
  }
  if (phase.matches_count === 0 || phase.can_reset) {
    return { label: 'Sorteado', className: 'bg-info-bg text-info' }
  }
  return { label: 'Em curso', className: 'bg-indigo-50 text-indigo-600' }
}

export function PhaseCard({
  phase,
  tournamentId,
  isAdmin,
  teams,
  multiTier = false,
}: PhaseCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: phase.id, disabled: !isAdmin })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const Icon = phase.type === 'group' ? Grid3x3 : GitMerge
  const status = phaseStatus(phase)
  const drawn = phase.type === 'group' && phase.groups.length > 0

  // Sorteio incremental: escalões com equipas inscritas que ainda não têm grupos
  // nesta fase. Permite sortear um escalão acrescentado depois do sorteio
  // inicial sem refazer o que já está feito.
  const tierByTeamId = new Map(teams.map((t) => [t.id, t.tier]))
  const drawnTiers = new Set<Tier>()
  for (const group of phase.groups) {
    for (const team of group.teams) {
      const tier = tierByTeamId.get(team.id)
      if (tier) drawnTiers.add(tier)
    }
  }
  const pendingTierTeams = teams.filter((t) => !drawnTiers.has(t.tier))
  const hasPendingTiers = multiTier && pendingTierTeams.length > 0

  const subtitle =
    phase.type === 'group'
      ? `${phase.groups.length} grupo(s)`
      : 'Eliminatórias'

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePhase(phase.id)
      if (result.success) {
        toast.success('Fase apagada.')
        setConfirmDelete(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid="phase-card"
      className={cn(
        'rounded-lg border border-border bg-card',
        isDragging && 'opacity-60'
      )}
    >
      <div className="flex items-center gap-3 p-4">
        {isAdmin ? (
          <button
            type="button"
            className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
            aria-label="Reordenar fase"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        ) : null}

        <button
          type="button"
          className="flex flex-1 items-center gap-3 text-left"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          data-testid="phase-toggle"
        >
          <Icon className="size-5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{phase.name}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
              status.className
            )}
          >
            {status.label}
          </span>
          <ChevronDown
            className={cn(
              'size-4 text-muted-foreground transition-transform',
              expanded && 'rotate-180'
            )}
          />
        </button>

        {isAdmin ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Opções da fase"
                data-testid="phase-menu"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" />
                Apagar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {expanded ? (
        phase.type === 'group' ? (
          drawn ? (
            <>
              <GroupsGrid
                phaseId={phase.id}
                groups={phase.groups}
                matchesCount={phase.matches_count}
                canReset={isAdmin && phase.can_reset}
                teams={teams}
                multiTier={multiTier}
              />
              {isAdmin && hasPendingTiers ? (
                <DrawPanel
                  phaseId={phase.id}
                  tournamentId={tournamentId}
                  teams={pendingTierTeams}
                  multiTier
                  incremental
                />
              ) : null}
            </>
          ) : isAdmin ? (
            <DrawPanel
              phaseId={phase.id}
              tournamentId={tournamentId}
              teams={teams}
              multiTier={multiTier}
            />
          ) : (
            <p className="border-t border-border p-4 text-sm text-muted-foreground">
              O sorteio ainda não foi efectuado.
            </p>
          )
        ) : (
          <KnockoutSection
            phaseId={phase.id}
            tournamentId={tournamentId}
            isAdmin={isAdmin}
          />
        )
      ) : null}

      <PhaseDialog
        tournamentId={tournamentId}
        multiTier={multiTier}
        phase={{
          id: phase.id,
          name: phase.name,
          type: phase.type,
          tier: phase.tier,
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar fase</AlertDialogTitle>
            <AlertDialogDescription>
              Tens a certeza que queres apagar “{phase.name}”? Os grupos desta
              fase também são removidos. Esta acção não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={isPending}
              className="bg-danger text-white hover:bg-danger/90"
            >
              Apagar fase
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
