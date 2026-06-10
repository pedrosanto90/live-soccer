'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle, RefreshCw } from 'lucide-react'

import { resetDraw } from '@/lib/actions/phases'
import type { GroupWithTeams } from '@/lib/queries/phases'
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
}

export function GroupsGrid({
  phaseId,
  groups,
  matchesCount,
  canReset,
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

  return (
    <div className="flex flex-col gap-4 border-t border-border p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <div
            key={group.id}
            data-testid="group-card"
            className="rounded-md border border-border bg-surface-2 p-3"
          >
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group.name}
            </p>
            <div className="flex flex-col gap-1.5">
              {group.teams.map((team) => {
                const initials =
                  team.short_name ?? team.name.slice(0, 2).toUpperCase()
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
        ))}
      </div>

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
