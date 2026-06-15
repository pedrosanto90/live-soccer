'use client'

import { useCallback, useState } from 'react'
import {
  Clock,
  ExternalLink,
  Minus,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { TeamAvatar } from '@/components/match/team-avatar'
import { AddEventDialog, type EventDialogMode } from '@/components/match/add-event-dialog'
import { EditEventDialog } from '@/components/match/edit-event-dialog'
import { EndMatchDialog } from '@/components/match/end-match-dialog'
import { PenaltyShootout } from '@/components/match/penalty-shootout'
import { useMatch } from '@/contexts/match-context'
import { useMatchRealtime } from '@/hooks/use-match-realtime'
import { useMatchBroadcast, type LiveAction } from '@/hooks/use-match-broadcast'
import { useTimer } from '@/hooks/use-timer'
import {
  cancelEvent,
  endHalf,
  finishMatch,
  pauseTimer,
  resetTimer,
  resumeTimer,
  setTimerManual,
  startExtraTime,
  startMatch,
  startSecondExtraHalf,
  startSecondHalf,
} from '@/lib/actions/match-admin'
import {
  cn,
  formatEventTime,
  getCurrentFouls,
  getPeriodLabel,
} from '@/lib/utils'
import type { MatchPlayerLite, MatchTeamLite } from '@/lib/queries/matches'
import type {
  ActionResult,
} from '@/types'
import type { EventType, Match, MatchEvent, TournamentSettings } from '@/types/database'

interface MatchAdminPanelProps {
  homeTeam: MatchTeamLite
  awayTeam: MatchTeamLite
  players: { home: MatchPlayerLite[]; away: MatchPlayerLite[] }
  settings: TournamentSettings
  isAdmin: boolean
  publicHref: string
}

export function MatchAdminPanel({
  homeTeam,
  awayTeam,
  players,
  settings,
  isAdmin,
  publicHref,
}: MatchAdminPanelProps) {
  const { state, dispatch } = useMatch()
  const { match, events, timerRunning } = state

  // Rede de segurança: postgres_changes (CDC) reconcilia se um broadcast se
  // perder ou se outro membro do staff editar o jogo.
  useMatchRealtime(match.id)
  // Caminho directo admin → público: transmite cada acção de estado.
  const broadcast = useMatchBroadcast(match.id, true)

  // Despacha localmente e transmite para os painéis públicos numa só chamada.
  const apply = useCallback(
    (action: LiveAction) => {
      dispatch(action)
      broadcast(action)
    },
    [dispatch, broadcast]
  )

  const isExtra =
    match.current_period === 'extra_first' ||
    match.current_period === 'extra_second'
  const halfSecs =
    (isExtra
      ? settings.match.extra_time_duration_minutes
      : settings.match.half_duration_minutes) * 60

  const { displayTime, remainingTime, isOvertime, isTimeUp } = useTimer(
    halfSecs,
    match.id
  )

  const [pending, setPending] = useState(false)
  const [manualMinutes, setManualMinutes] = useState(0)
  const [manualSeconds, setManualSeconds] = useState(0)
  const [dialog, setDialog] = useState<{
    teamId: string
    mode: EventDialogMode
  } | null>(null)
  const [editing, setEditing] = useState<MatchEvent | null>(null)
  const [endOpen, setEndOpen] = useState(false)
  const [allowExtra, setAllowExtra] = useState(true)
  // Em mobile os inputs de tempo manual ficam num diálogo (não cabem na barra).
  const [setTimeOpen, setSetTimeOpen] = useState(false)

  const canEdit = isAdmin && match.status !== 'finished' && match.status !== 'cancelled'
  const inPlay = match.status === 'in_progress' || match.status === 'extra_time'

  // Executa uma Server Action que devolve o jogo actualizado e reflecte o
  // resultado imediatamente (o Realtime reconcilia em seguida).
  async function run(promise: Promise<ActionResult<Match>>) {
    setPending(true)
    const res = await promise
    setPending(false)
    if (res.success) apply({ type: 'MATCH_UPDATED', payload: res.data })
    else toast.error(res.error)
    return res
  }

  function openDialog(teamId: string, mode: EventDialogMode) {
    setDialog({ teamId, mode })
  }

  // Anula o golo mais recente de uma equipa (o evento mais recente que somou ao
  // marcador desse lado: golo/penálti próprio ou golo na própria do adversário).
  // Reaproveita a anulação de eventos, mantendo marcador e log consistentes.
  function handleRemoveGoal(side: 'home' | 'away') {
    const teamId = side === 'home' ? homeTeam.id : awayTeam.id
    const oppId = side === 'home' ? awayTeam.id : homeTeam.id
    const last = events.find(
      (e) =>
        !e.is_cancelled &&
        (((e.event_type === 'goal' || e.event_type === 'penalty_scored') &&
          e.team_id === teamId) ||
          (e.event_type === 'own_goal' && e.team_id === oppId))
    )
    if (!last) {
      toast.info('Sem golos para remover.')
      return
    }
    void handleCancelEvent(last.id)
  }

  async function handlePlayPause() {
    await run(timerRunning ? pauseTimer(match.id) : resumeTimer(match.id))
  }

  function handleEventUpdated(event: MatchEvent) {
    apply({ type: 'EVENT_UPDATED', payload: event })
  }

  async function handleCancelEvent(id: string) {
    const res = await cancelEvent(id)
    if (res.success) {
      apply({ type: 'EVENT_CANCELLED', payload: id })
      apply({ type: 'MATCH_UPDATED', payload: res.data.match })
    } else toast.error(res.error)
  }

  // Terminar o jogo (ou o prolongamento): se houver empate, abre o modal de
  // decisão; caso contrário termina já.
  function handleFinish(fromExtra: boolean) {
    if (match.home_score === match.away_score) {
      setAllowExtra(!fromExtra)
      setEndOpen(true)
      return
    }
    void run(finishMatch(match.id, 'finish'))
  }

  // As faltas são contabilizadas no contador, não no log; só os cartões e os
  // golos aparecem aqui (uma falta com cartão gera um evento de cartão à parte).
  const periodEvents = events.filter(
    (e) => e.period === match.current_period && e.event_type !== 'foul'
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <StatusBadge status={match.status} />
          {match.current_period ? (
            <span className="text-xs text-muted-foreground">
              {getPeriodLabel(match.current_period)}
            </span>
          ) : null}
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={publicHref} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-3.5" />
            Placar do recinto
          </a>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Coluna principal */}
        <div className="space-y-4 lg:col-span-3">
          {/* Scoreboard */}
          <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
            <div className="grid grid-cols-3 items-center gap-2 sm:gap-4">
              <ScoreSide
                team={homeTeam}
                score={match.home_score}
                canScore={canEdit && inPlay}
                onGoal={() => openDialog(homeTeam.id, 'goal')}
                onRemoveGoal={() => handleRemoveGoal('home')}
                onFoul={() => openDialog(homeTeam.id, 'foul')}
              />
              <div className="flex flex-col items-center gap-1">
                <p className="text-4xl font-medium tabular-nums text-muted-foreground">
                  :
                </p>
              </div>
              <ScoreSide
                team={awayTeam}
                score={match.away_score}
                canScore={canEdit && inPlay}
                onGoal={() => openDialog(awayTeam.id, 'goal')}
                onRemoveGoal={() => handleRemoveGoal('away')}
                onFoul={() => openDialog(awayTeam.id, 'foul')}
              />
            </div>
          </div>

          {/* Timer */}
          {match.status !== 'scheduled' && match.status !== 'penalties' ? (
            <div className="rounded-lg border border-border bg-surface-2 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
                <div className="text-center">
                  <p
                    className={cn(
                      'text-2xl font-medium tabular-nums sm:text-3xl',
                      isOvertime ? 'text-warning' : 'text-foreground',
                      isTimeUp && 'text-warning animate-blink'
                    )}
                  >
                    {remainingTime}
                  </p>
                  <p className="text-[10px] text-muted-foreground sm:text-xs">
                    Decorrido {displayTime}
                  </p>
                </div>

                {canEdit && inPlay ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={timerRunning || pending}
                      onClick={() => run(resetTimer(match.id))}
                    >
                      <RotateCcw className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      className={timerRunning ? 'bg-warning hover:bg-warning/90' : ''}
                      disabled={pending}
                      onClick={handlePlayPause}
                    >
                      {timerRunning ? (
                        <Pause className="size-4" />
                      ) : (
                        <Play className="size-4" />
                      )}
                    </Button>
                  </div>
                ) : null}

                {!timerRunning && canEdit && inPlay ? (
                  <>
                    {/* Inputs inline — tablet/desktop */}
                    <div className="hidden items-center gap-1 sm:flex">
                      <Input
                        type="number"
                        min={0}
                        max={99}
                        className="h-8 w-14 text-center"
                        value={manualMinutes}
                        onChange={(e) => setManualMinutes(Number(e.target.value))}
                      />
                      <span className="text-sm text-muted-foreground">:</span>
                      <Input
                        type="number"
                        min={0}
                        max={59}
                        className="h-8 w-14 text-center"
                        value={manualSeconds}
                        onChange={(e) => setManualSeconds(Number(e.target.value))}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          run(setTimerManual(match.id, manualMinutes, manualSeconds))
                        }
                      >
                        Definir
                      </Button>
                    </div>
                    {/* Botão que abre o diálogo — mobile */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="sm:hidden"
                      onClick={() => setSetTimeOpen(true)}
                    >
                      <Clock className="size-3.5" /> Definir tempo
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Controlos da partida */}
          {canEdit ? (
            <MatchControls
              match={match}
              pending={pending}
              onStart={() => run(startMatch(match.id))}
              onEndHalf={() => run(endHalf(match.id))}
              onStartSecondHalf={() => run(startSecondHalf(match.id))}
              onStartSecondExtra={() => run(startSecondExtraHalf(match.id))}
              onStartExtra={() => run(startExtraTime(match.id))}
              onFinish={handleFinish}
            />
          ) : null}

          {/* Penáltis */}
          {match.status === 'penalties' ? (
            <PenaltyShootout
              matchId={match.id}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              players={players}
              settings={settings}
              isAdmin={isAdmin}
              onApply={apply}
            />
          ) : null}
        </div>

        {/* Coluna lateral */}
        <div className="space-y-4 lg:col-span-2">
          {/* Faltas */}
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Faltas — {getPeriodLabel(match.current_period) || '—'}
            </p>
            {(['home', 'away'] as const).map((side) => {
              const team = side === 'home' ? homeTeam : awayTeam
              const fouls = getCurrentFouls(match, side, match.current_period)
              const max = settings.match.max_fouls_per_team_per_half
              const atLimit = fouls >= max
              return (
                <div
                  key={side}
                  className="flex items-center justify-between py-1.5"
                >
                  <p className="truncate text-sm">{team.name}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {Array.from({ length: max }).map((_, i) => (
                        <span
                          key={i}
                          className={cn(
                            'size-2 rounded-full',
                            i < fouls
                              ? atLimit
                                ? 'bg-danger'
                                : 'bg-primary'
                              : 'bg-border'
                          )}
                        />
                      ))}
                    </div>
                    <span
                      className={cn(
                        'w-8 text-right text-sm font-medium tabular-nums',
                        atLimit ? 'text-danger' : ''
                      )}
                    >
                      {fouls}
                      {atLimit ? ' ⚠' : ''}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Eventos recentes */}
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Eventos
            </p>
            {periodEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda sem eventos.</p>
            ) : (
              <ul className="space-y-1">
                {periodEvents.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    teamName={
                      event.team_id === homeTeam.id
                        ? homeTeam.short_name ?? homeTeam.name
                        : awayTeam.short_name ?? awayTeam.name
                    }
                    canEdit={canEdit && !event.is_cancelled}
                    onEdit={() => setEditing(event)}
                    onCancel={() => handleCancelEvent(event.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {dialog ? (
        <AddEventDialog
          key={`${dialog.teamId}-${dialog.mode}`}
          mode={dialog.mode}
          matchId={match.id}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          players={players}
          teamId={dialog.teamId}
          currentElapsedSecs={state.elapsedSecs}
          open={dialog != null}
          onOpenChange={(open) => {
            if (!open) setDialog(null)
          }}
          onAdded={({ events: added, match: updated }) => {
            added.forEach((event) => apply({ type: 'EVENT_ADDED', payload: event }))
            apply({ type: 'MATCH_UPDATED', payload: updated })
          }}
        />
      ) : null}

      {editing ? (
        <EditEventDialog
          key={editing.id}
          event={editing}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          players={players}
          open={editing != null}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          onSaved={handleEventUpdated}
        />
      ) : null}

      <EndMatchDialog
        open={endOpen}
        onOpenChange={setEndOpen}
        settings={settings}
        allowExtra={allowExtra}
        pending={pending}
        onChoose={(outcome) => {
          setEndOpen(false)
          void run(finishMatch(match.id, outcome))
        }}
      />

      {/* Definir tempo manualmente — mobile */}
      <Dialog open={setTimeOpen} onOpenChange={setSetTimeOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Definir tempo</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center gap-2 py-2">
            <Input
              type="number"
              min={0}
              max={99}
              aria-label="Minutos"
              className="h-11 w-16 text-center"
              value={manualMinutes}
              onChange={(e) => setManualMinutes(Number(e.target.value))}
            />
            <span className="text-lg text-muted-foreground">:</span>
            <Input
              type="number"
              min={0}
              max={59}
              aria-label="Segundos"
              className="h-11 w-16 text-center"
              value={manualSeconds}
              onChange={(e) => setManualSeconds(Number(e.target.value))}
            />
          </div>
          <DialogFooter>
            <Button
              className="w-full"
              disabled={pending}
              onClick={async () => {
                await run(setTimerManual(match.id, manualMinutes, manualSeconds))
                setSetTimeOpen(false)
              }}
            >
              Definir tempo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Subcomponentes ─────────────────────────────────────────────────────────

function ScoreSide({
  team,
  score,
  canScore,
  onGoal,
  onRemoveGoal,
  onFoul,
}: {
  team: MatchTeamLite
  score: number
  canScore: boolean
  onGoal: () => void
  onRemoveGoal: () => void
  onFoul: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-1 sm:gap-2">
      <TeamAvatar
        team={team}
        className="size-8 text-sm sm:size-12 sm:text-base"
      />
      <p className="max-w-[80px] truncate text-center text-xs font-medium sm:max-w-none sm:text-sm">
        <span className="sm:hidden">{team.short_name ?? team.name}</span>
        <span className="hidden sm:inline">{team.name}</span>
      </p>
      <p className="text-4xl font-medium tabular-nums sm:text-5xl">{score}</p>
      {canScore ? (
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5">
            <Button
              size="icon-xs"
              variant="outline"
              disabled={score <= 0}
              aria-label="Remover golo"
              onClick={onRemoveGoal}
            >
              <Minus className="size-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="px-2 sm:px-3"
              aria-label="Adicionar golo"
              onClick={onGoal}
            >
              <Plus className="size-3" /> <span className="hidden sm:inline">Golo</span>
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="px-2 sm:px-3"
            aria-label="Adicionar falta"
            onClick={onFoul}
          >
            <Plus className="size-3" /> <span className="hidden sm:inline">Falta</span>
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function MatchControls({
  match,
  pending,
  onStart,
  onEndHalf,
  onStartSecondHalf,
  onStartSecondExtra,
  onStartExtra,
  onFinish,
}: {
  match: Match
  pending: boolean
  onStart: () => void
  onEndHalf: () => void
  onStartSecondHalf: () => void
  onStartSecondExtra: () => void
  onStartExtra: () => void
  onFinish: (fromExtra: boolean) => void
}) {
  const { status, current_period } = match

  if (status === 'scheduled') {
    return (
      <Button className="w-full" disabled={pending} onClick={onStart}>
        <Play className="size-4" /> Iniciar jogo
      </Button>
    )
  }

  if (status === 'half_time') {
    // Intervalo entre 1.ª e 2.ª parte (o prolongamento não passa por half_time).
    return (
      <Button className="w-full" disabled={pending} onClick={onStartSecondHalf}>
        <Play className="size-4" /> Iniciar 2.ª parte
      </Button>
    )
  }

  if (status === 'in_progress' && current_period === 'first_half') {
    return (
      <Button
        variant="outline"
        className="w-full"
        disabled={pending}
        onClick={onEndHalf}
      >
        Terminar 1.ª parte
      </Button>
    )
  }

  if (status === 'in_progress' && current_period === 'second_half') {
    return (
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          disabled={pending}
          onClick={onEndHalf}
        >
          Terminar 2.ª parte
        </Button>
        <Button
          variant="destructive"
          className="flex-1"
          disabled={pending}
          onClick={() => onFinish(false)}
        >
          Terminar jogo
        </Button>
      </div>
    )
  }

  if (status === 'extra_time' && current_period === 'extra_first') {
    return (
      <Button
        variant="outline"
        className="w-full"
        disabled={pending}
        onClick={onStartSecondExtra}
      >
        Iniciar 2.ª parte extra
      </Button>
    )
  }

  if (status === 'extra_time' && current_period === 'extra_second') {
    return (
      <Button
        variant="destructive"
        className="w-full"
        disabled={pending}
        onClick={() => onFinish(true)}
      >
        Terminar prolongamento
      </Button>
    )
  }

  // Salvaguarda: prolongamento já iniciado mas ainda na 1.ª parte sem botão de
  // fim (cobre a transição extra_first → fim direto, se aplicável).
  if (status === 'extra_time') {
    return (
      <Button
        variant="outline"
        className="w-full"
        disabled={pending}
        onClick={onStartExtra}
      >
        Prolongamento
      </Button>
    )
  }

  return null
}

const EVENT_ICONS: Record<EventType, { symbol: string; className: string }> = {
  goal: { symbol: '⚽', className: 'text-success' },
  own_goal: { symbol: '⚽', className: 'text-danger' },
  foul: { symbol: '⚠', className: 'text-warning' },
  yellow_card: { symbol: '▮', className: 'text-warning' },
  red_card: { symbol: '▮', className: 'text-danger' },
  penalty_scored: { symbol: '✓', className: 'text-success' },
  penalty_missed: { symbol: '✗', className: 'text-danger' },
}

const EVENT_NAMES: Record<EventType, string> = {
  goal: 'Golo',
  own_goal: 'Golo contra',
  foul: 'Falta',
  yellow_card: 'Amarelo',
  red_card: 'Vermelho',
  penalty_scored: 'Penálti',
  penalty_missed: 'Penálti falhado',
}

function EventRow({
  event,
  teamName,
  canEdit,
  onEdit,
  onCancel,
}: {
  event: MatchEvent
  teamName: string
  canEdit: boolean
  onEdit: () => void
  onCancel: () => void
}) {
  const icon = EVENT_ICONS[event.event_type]
  return (
    <li
      className={cn(
        'flex items-center gap-2 text-sm',
        event.is_cancelled && 'text-muted-foreground line-through opacity-60'
      )}
    >
      <span className={cn('w-4 text-center', icon.className)}>{icon.symbol}</span>
      <span className="text-muted-foreground">{teamName}</span>
      <span className="flex-1 truncate">
        {event.player_name ?? EVENT_NAMES[event.event_type]}
      </span>
      <span className="tabular-nums text-muted-foreground">
        {formatEventTime(event.elapsed_secs)}&apos;
      </span>
      {canEdit ? (
        <>
          <Button size="icon-xs" variant="ghost" onClick={onEdit}>
            <Pencil className="size-3" />
          </Button>
          <Button size="icon-xs" variant="ghost" onClick={onCancel}>
            <X className="size-3" />
          </Button>
        </>
      ) : null}
    </li>
  )
}
