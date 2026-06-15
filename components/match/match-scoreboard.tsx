'use client'

import { StatusBadge } from '@/components/ui/status-badge'
import { useMatch } from '@/contexts/match-context'
import { useMatchRealtime } from '@/hooks/use-match-realtime'
import { useMatchBroadcast } from '@/hooks/use-match-broadcast'
import { useTimer } from '@/hooks/use-timer'
import { cn, getCurrentFouls, getPeriodLabel } from '@/lib/utils'
import type { MatchTeamLite } from '@/lib/queries/matches'
import type { TournamentSettings } from '@/types/database'

interface MatchScoreboardProps {
  homeTeam: MatchTeamLite
  awayTeam: MatchTeamLite
  tournamentName: string
  phaseName: string
  groupName: string | null
  settings: TournamentSettings
}

// Placar para o recinto do torneio (ecrã grande). Mostra apenas o essencial,
// legível à distância: tempo, resultado, faltas, fase/grupo e a parte do jogo.
// Sem histórico de eventos — esse é relevante na vista de espetador, não aqui.
export function MatchScoreboard({
  homeTeam,
  awayTeam,
  tournamentName,
  phaseName,
  groupName,
  settings,
}: MatchScoreboardProps) {
  const { state } = useMatch()
  const { match } = state

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

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-[3vh] p-[3vw]">
      <div className="text-center">
        <p className="text-[1.8vw] uppercase tracking-widest text-muted-foreground">
          {tournamentName}
        </p>
        <p className="text-[1.4vw] text-muted-foreground">
          {phaseName}
          {groupName ? ` · ${groupName}` : ''}
        </p>
      </div>

      <div className="flex flex-col items-center gap-[1vh]">
        <StatusBadge
          status={match.status}
          className="text-[1.6vw] px-[1.4vw] py-[0.5vw]"
        />
        {match.current_period ? (
          <p className="text-[1.4vw] text-muted-foreground">
            {getPeriodLabel(match.current_period)}
          </p>
        ) : null}
      </div>

      <div className="grid w-full max-w-[90vw] grid-cols-3 items-center gap-[4vw]">
        <ScoreboardTeamScore team={homeTeam} score={match.home_score} />
        {showTimer ? (
          <p
            className={cn(
              'text-center text-[7vw] font-medium leading-none tabular-nums tracking-tight',
              isOvertime ? 'text-warning' : 'text-foreground',
              isTimeUp && 'text-warning animate-blink'
            )}
          >
            {remainingTime}
          </p>
        ) : (
          <p className="text-center text-[9vw] leading-none text-muted-foreground">:</p>
        )}
        <ScoreboardTeamScore team={awayTeam} score={match.away_score} />
      </div>

      {match.status === 'penalties' || match.home_penalties || match.away_penalties ? (
        <p className="text-[2.2vw] text-muted-foreground">
          Penáltis {match.home_penalties} — {match.away_penalties}
        </p>
      ) : null}

      <div className="flex gap-[6vw]">
        {(['home', 'away'] as const).map((side) => {
          const team = side === 'home' ? homeTeam : awayTeam
          const fouls = getCurrentFouls(match, side, match.current_period)
          return (
            <div key={side} className="flex flex-col items-center gap-[1.2vh]">
              <p className="text-[1.4vw] uppercase tracking-wide text-muted-foreground">
                Faltas {team.short_name ?? team.name}
              </p>
              <div className="flex gap-[0.6vw]">
                {Array.from({ length: maxFouls }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'size-[1.8vw] rounded-full',
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
    </div>
  )
}

function ScoreboardTeamScore({
  team,
  score,
}: {
  team: MatchTeamLite
  score: number
}) {
  return (
    <div className="flex flex-col items-center gap-[1.5vh]">
      <span
        className="h-[0.6vh] w-[8vw] rounded-full"
        style={{ background: team.color_primary }}
      />
      <p className="text-center text-[2.6vw] font-medium">{team.short_name ?? team.name}</p>
      <p className="text-[17vw] font-medium leading-none tabular-nums">{score}</p>
    </div>
  )
}
