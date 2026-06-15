'use client'

import { StatusBadge } from '@/components/ui/status-badge'
import { useMatch } from '@/contexts/match-context'
import { useMatchRealtime } from '@/hooks/use-match-realtime'
import { useMatchBroadcast } from '@/hooks/use-match-broadcast'
import { useTimer } from '@/hooks/use-timer'
import { cn, formatEventTime, getCurrentFouls, getPeriodLabel } from '@/lib/utils'
import type { MatchTeamLite } from '@/lib/queries/matches'
import type { EventType, TournamentSettings } from '@/types/database'

interface MatchPublicPanelProps {
  homeTeam: MatchTeamLite
  awayTeam: MatchTeamLite
  tournamentName: string
  phaseName: string
  groupName: string | null
  settings: TournamentSettings
}

// Vista de espetador (web/telemóvel). Acompanha o jogo com detalhe: resultado,
// tempo, faltas e o histórico completo de eventos. Para o ecrã do recinto usa-se
// o MatchScoreboard, que omite o histórico.
export function MatchPublicPanel({
  homeTeam,
  awayTeam,
  tournamentName,
  phaseName,
  groupName,
  settings,
}: MatchPublicPanelProps) {
  const { state } = useMatch()
  const { match, events } = state

  // Fonte primária: broadcasts directos do painel admin. Rede de segurança:
  // postgres_changes (CDC), caso um broadcast se perca ou a carga inicial
  // (SSR) esteja desactualizada.
  useMatchBroadcast(match.id, false)
  useMatchRealtime(match.id)

  const isExtra =
    match.current_period === 'extra_first' ||
    match.current_period === 'extra_second'
  const halfSecs =
    (isExtra
      ? settings.match.extra_time_duration_minutes
      : settings.match.half_duration_minutes) * 60

  const { remainingTime, isOvertime, isTimeUp } = useTimer(halfSecs, match.id)

  const maxFouls = settings.match.max_fouls_per_team_per_half
  const showTimer =
    match.status !== 'scheduled' &&
    match.status !== 'finished' &&
    match.status !== 'penalties'

  // Histórico completo, mais recente primeiro. Faltas ficam de fora — já estão
  // resumidas no contador acima.
  const timeline = events
    .filter((e) => !e.is_cancelled && e.event_type !== 'foul')
    .slice()
    .sort((a, b) => b.elapsed_secs - a.elapsed_secs)

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground sm:text-sm">
          {tournamentName}
        </p>
        <p className="text-sm text-muted-foreground">
          {phaseName}
          {groupName ? ` · ${groupName}` : ''}
        </p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <StatusBadge status={match.status} />
        {match.current_period ? (
          <p className="text-sm text-muted-foreground">
            {getPeriodLabel(match.current_period)}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-3 items-center gap-4">
        <PublicTeamScore team={homeTeam} score={match.home_score} />
        {showTimer ? (
          <p
            className={cn(
              'text-center text-4xl font-medium leading-none tabular-nums tracking-tight sm:text-5xl lg:text-6xl',
              isOvertime ? 'text-warning' : 'text-foreground',
              isTimeUp && 'text-warning animate-blink'
            )}
          >
            {remainingTime}
          </p>
        ) : (
          <p className="text-center text-5xl leading-none text-muted-foreground">:</p>
        )}
        <PublicTeamScore team={awayTeam} score={match.away_score} />
      </div>

      {match.status === 'penalties' || match.home_penalties || match.away_penalties ? (
        <p className="text-center text-base text-muted-foreground">
          Penáltis {match.home_penalties} — {match.away_penalties}
        </p>
      ) : null}

      <div className="flex justify-center gap-12">
        {(['home', 'away'] as const).map((side) => {
          const team = side === 'home' ? homeTeam : awayTeam
          const fouls = getCurrentFouls(match, side, match.current_period)
          return (
            <div key={side} className="flex flex-col items-center gap-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Faltas {team.short_name ?? team.name}
              </p>
              <div className="flex gap-1.5">
                {Array.from({ length: maxFouls }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'size-2 rounded-full sm:size-2.5',
                      i < fouls
                        ? fouls >= maxFouls
                          ? 'bg-danger'
                          : 'bg-primary'
                        : 'bg-border'
                    )}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {timeline.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Eventos
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {timeline.map((event) => {
              const team = event.team_id === homeTeam.id ? homeTeam : awayTeam
              return (
                <li
                  key={event.id}
                  className="flex items-center gap-3 px-3 py-2 text-sm"
                >
                  <span className="w-8 shrink-0 tabular-nums text-muted-foreground">
                    {formatEventTime(event.elapsed_secs)}&apos;
                  </span>
                  <span className="shrink-0">{eventIcon(event.event_type)}</span>
                  <span className="flex-1 truncate">
                    {event.player_name ?? '—'}
                  </span>
                  <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
                    {team.short_name ?? team.name}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function eventIcon(type: EventType): string {
  switch (type) {
    case 'goal':
      return '⚽'
    case 'own_goal':
      return '⚽ (p.b.)'
    case 'penalty_scored':
      return '⚽ (gp)'
    case 'penalty_missed':
      return '❌ (gp)'
    case 'yellow_card':
      return '🟨'
    case 'red_card':
      return '🟥'
    default:
      return ''
  }
}

function PublicTeamScore({
  team,
  score,
}: {
  team: MatchTeamLite
  score: number
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className="h-1 w-12 rounded-full"
        style={{ background: team.color_primary }}
      />
      <p className="text-center text-base font-medium sm:text-lg">
        {team.short_name ?? team.name}
      </p>
      <p className="text-6xl font-medium leading-none tabular-nums sm:text-7xl lg:text-8xl">
        {score}
      </p>
    </div>
  )
}
