'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarClock, MoreHorizontal, Pencil, Settings2, Trash2 } from 'lucide-react'

import { deleteMatch } from '@/lib/actions/matches'
import type {
  MatchWithRelations,
  MatchRefereeLite,
  MatchTeamLite,
} from '@/lib/queries/matches'
import { cn, formatMatchDate } from '@/lib/utils'
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
  // Jogos de bracket são geridos pela árvore de eliminatórias: as equipas vêm do
  // avanço automático (não se editam) e apagar um partiria a árvore (usa-se
  // "Refazer bracket"). Agendar continua a fazer sentido.
  const isBracket = match.bracket_round != null
  const canDelete = isAdmin && isScheduled && !isBracket

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
        className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-border/80 sm:px-4 sm:py-3"
      >
        {/* Linha de estado/data — só mobile (em desktop fica na coluna lateral) */}
        <div className="mb-2 flex items-center justify-between sm:hidden">
          <StatusBadge status={match.status} size="sm" />
          {match.scheduled_at ? (
            <p className="text-[10px] text-muted-foreground">
              {formatMatchDate(match.scheduled_at)}
            </p>
          ) : (
            <p className="text-[10px] italic text-muted-foreground">Por agendar</p>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden w-28 shrink-0 flex-col gap-0.5 sm:flex">
            <StatusBadge status={match.status} size="sm" />
            {match.scheduled_at ? (
              <p className="text-[10px] text-muted-foreground">
                {formatMatchDate(match.scheduled_at)}
              </p>
            ) : (
              <p className="text-[10px] italic text-muted-foreground">Por agendar</p>
            )}
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
            <span
              className={cn(
                'truncate text-xs font-medium sm:text-sm',
                !match.home_team && 'italic text-muted-foreground'
              )}
            >
              {match.home_team?.name ?? 'A definir'}
            </span>
            <TeamSlot team={match.home_team} />
          </div>

          <div className="w-12 shrink-0 text-center sm:w-16">
            {match.status === 'scheduled' ? (
              <span className="text-sm font-medium text-muted-foreground">vs</span>
            ) : (
              <span className="text-sm font-medium tabular-nums sm:text-base">
                {match.home_score} — {match.away_score}
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
            <TeamSlot team={match.away_team} />
            <span
              className={cn(
                'truncate text-xs font-medium sm:text-sm',
                !match.away_team && 'italic text-muted-foreground'
              )}
            >
              {match.away_team?.name ?? 'A definir'}
            </span>
          </div>

          {match.venue ? (
            <p className="hidden w-24 truncate text-right text-xs text-muted-foreground lg:block">
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
                {!isBracket ? (
                  <DropdownMenuItem onSelect={() => router.push(`${base}/edit`)}>
                    <Pencil className="size-4" />
                    Editar
                  </DropdownMenuItem>
                ) : null}
                {canDelete ? (
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
          ) : null}
          </div>
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
              Tens a certeza que queres apagar o jogo {match.home_team?.name} vs{' '}
              {match.away_team?.name}? Esta acção não pode ser desfeita.
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

// Distintivo da equipa, ou um placeholder neutro quando o slot do bracket ainda
// está por preencher ("A definir").
function TeamSlot({ team }: { team: MatchTeamLite | null }) {
  if (!team) {
    return (
      <div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-[10px] text-muted-foreground">
        ?
      </div>
    )
  }
  return <TeamAvatar team={team} />
}
