'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarClock, MoreHorizontal, Pencil, Settings2, Trash2 } from 'lucide-react'

import { deleteMatch } from '@/lib/actions/matches'
import type { MatchWithRelations, MatchRefereeLite } from '@/lib/queries/matches'
import { formatMatchDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { TeamAvatar } from '@/components/match/team-avatar'
import { ScheduleDialog } from '@/components/match/schedule-dialog'
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

interface MatchRowProps {
  match: MatchWithRelations
  tournamentId: string
  referees: MatchRefereeLite[]
  isAdmin: boolean
}

export function MatchRow({ match, tournamentId, referees, isAdmin }: MatchRowProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const base = `/tournaments/${tournamentId}/matches/${match.id}`
  const isScheduled = match.status === 'scheduled'
  const showAdminActions = isScheduled || match.status === 'in_progress'

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteMatch(match.id)
      if (result.success) {
        toast.success('Jogo apagado.')
        setConfirmDelete(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <>
      <div
        data-testid="match-row"
        className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-border/80"
      >
        <div className="flex w-28 shrink-0 flex-col gap-0.5">
          <StatusBadge status={match.status} size="sm" />
          {match.scheduled_at ? (
            <p className="text-[10px] text-muted-foreground">
              {formatMatchDate(match.scheduled_at)}
            </p>
          ) : (
            <p className="text-[10px] italic text-muted-foreground">Por agendar</p>
          )}
        </div>

        <div className="flex flex-1 items-center justify-end gap-2">
          <span className="truncate text-sm font-medium">{match.home_team.name}</span>
          <TeamAvatar team={match.home_team} />
        </div>

        <div className="w-16 shrink-0 text-center">
          {match.status === 'scheduled' ? (
            <span className="text-sm font-medium text-muted-foreground">vs</span>
          ) : (
            <span className="text-base font-medium tabular-nums">
              {match.home_score} — {match.away_score}
            </span>
          )}
        </div>

        <div className="flex flex-1 items-center gap-2">
          <TeamAvatar team={match.away_team} />
          <span className="truncate text-sm font-medium">{match.away_team.name}</span>
        </div>

        {match.venue ? (
          <p className="hidden w-24 truncate text-right text-xs text-muted-foreground sm:block">
            {match.venue}
          </p>
        ) : null}

        <div className="flex shrink-0 items-center gap-1">
          {showAdminActions ? (
            <Button variant="ghost" size="icon" asChild aria-label="Detalhe do jogo">
              <Link href={base}>
                <Settings2 className="size-4" />
              </Link>
            </Button>
          ) : null}

          {isAdmin && isScheduled ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Opções do jogo"
                  data-testid="match-menu"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setScheduleOpen(true)}>
                  <CalendarClock className="size-4" />
                  Agendar
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push(`${base}/edit`)}>
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
      </div>

      {isAdmin && isScheduled ? (
        <ScheduleDialog
          match={match}
          referees={referees}
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
        />
      ) : null}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar jogo</AlertDialogTitle>
            <AlertDialogDescription>
              Tens a certeza que queres apagar o jogo {match.home_team.name} vs{' '}
              {match.away_team.name}? Esta acção não pode ser desfeita.
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
              Apagar jogo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
