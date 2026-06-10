'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Calendar, ExternalLink, MoreHorizontal, Pencil, Trash2, XCircle } from 'lucide-react'

import { cn, formatDate } from '@/lib/utils'
import { deleteTournament, updateTournamentStatus } from '@/lib/actions/tournaments'
import type { TournamentWithStats } from '@/lib/queries/tournaments'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
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
import { useState } from 'react'

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-medium leading-none">{value}</span>
      <span className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

export function TournamentCard({ tournament }: { tournament: TournamentWithStats }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const { stats } = tournament

  function goToOverview() {
    router.push(`/tournaments/${tournament.id}`)
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTournament(tournament.id)
      if (result && !result.success) {
        toast.error(result.error)
      }
      // Em caso de sucesso a action redirecciona para /dashboard.
    })
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await updateTournamentStatus(tournament.id, 'cancelled')
      if (result.success) {
        toast.success('Torneio cancelado.')
        setConfirmCancel(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <>
      <div
        role="link"
        tabIndex={0}
        data-testid="tournament-card"
        onClick={goToOverview}
        onKeyDown={(e) => {
          if (e.key === 'Enter') goToOverview()
        }}
        className={cn(
          'flex cursor-pointer flex-col gap-4 rounded-lg border border-border bg-card p-5 transition-colors hover:border-border/80'
        )}
      >
        <div className="flex items-start justify-between">
          <StatusBadge status={tournament.status} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Opções do torneio"
                data-testid="tournament-menu"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem
                onSelect={() => router.push(`/tournaments/${tournament.id}/edit`)}
              >
                <Pencil className="size-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  window.open(`/t/${tournament.slug}`, '_blank', 'noopener')
                }
              >
                <ExternalLink className="size-4" />
                Ver página pública
              </DropdownMenuItem>

              {tournament.status === 'active' ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setConfirmCancel(true)}
                  >
                    <XCircle className="size-4" />
                    Cancelar torneio
                  </DropdownMenuItem>
                </>
              ) : null}

              {tournament.status === 'draft' ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="size-4" />
                    Apagar
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-medium leading-snug">{tournament.name}</h3>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="size-3.5" />
            {tournament.starts_at
              ? formatDate(tournament.starts_at)
              : 'Datas a definir'}
          </p>
        </div>

        <div className="flex gap-6 border-t border-border pt-3">
          <StatItem label="Equipas" value={stats.teams} />
          <StatItem label="Jogos" value={stats.matches} />
          <StatItem label="Em curso" value={stats.active_matches} />
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar torneio</AlertDialogTitle>
            <AlertDialogDescription>
              Tens a certeza? Esta acção não pode ser desfeita. Todos os dados do
              torneio serão permanentemente apagados.
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
              Apagar torneio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar torneio</AlertDialogTitle>
            <AlertDialogDescription>
              Tens a certeza que queres cancelar este torneio? Os jogos deixarão de
              poder ser geridos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleCancel()
              }}
              disabled={isPending}
              className="bg-danger text-white hover:bg-danger/90"
            >
              Cancelar torneio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
