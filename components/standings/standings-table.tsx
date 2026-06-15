'use client'

import { useMemo } from 'react'

import { cn } from '@/lib/utils'
import { sortStandings, type StandingRow } from '@/lib/standings'
import { TeamAvatar } from '@/components/match/team-avatar'
import type { TiebreakerCriterion } from '@/types/database'

interface StandingsTableProps {
  standings: StandingRow[]
  tiebreakOrder: TiebreakerCriterion[]
  // Destaca uma equipa específica (ex.: a equipa de um jogo a decorrer).
  highlightTeamId?: string
  // Nº de equipas apuradas — desenha a linha divisória após a última.
  qualifyingSpots?: number
  // Versão reduzida para painéis laterais (nomes curtos, sem legenda).
  compact?: boolean
}

export function StandingsTable({
  standings,
  tiebreakOrder,
  highlightTeamId,
  qualifyingSpots,
  compact = false,
}: StandingsTableProps) {
  const sorted = useMemo(
    () => sortStandings(standings, tiebreakOrder),
    [standings, tiebreakOrder]
  )

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <Th className="w-8 text-left px-2">#</Th>
              <Th className="text-left px-2">Equipa</Th>
              <Th className="hidden w-8 px-1 sm:table-cell">J</Th>
              <Th className="hidden w-8 px-1 sm:table-cell">V</Th>
              <Th className="hidden w-8 px-1 sm:table-cell">E</Th>
              <Th className="hidden w-8 px-1 sm:table-cell">D</Th>
              <Th className="hidden w-10 px-1 lg:table-cell">GM</Th>
              <Th className="hidden w-10 px-1 lg:table-cell">GS</Th>
              <Th className="hidden w-10 px-1 lg:table-cell">DG</Th>
              <Th className="w-10 px-2 font-semibold">Pts</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, index) => {
              const isQualifying = qualifyingSpots != null && index < qualifyingSpots
              const isHighlighted = row.team_id === highlightTeamId
              const isLastQualifying =
                qualifyingSpots != null && index === qualifyingSpots - 1

              return (
                <tr
                  key={row.id}
                  data-testid="standings-row"
                  className={cn(
                    'border-b border-border transition-colors last:border-0',
                    isHighlighted ? 'bg-accent/50' : 'hover:bg-surface-2',
                    isLastQualifying && 'border-b-2 border-b-primary/30'
                  )}
                >
                  <td className="px-2 py-2.5 text-xs tabular-nums text-muted-foreground">
                    {index + 1}
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2">
                      <TeamAvatar team={row.team} />
                      <span
                        className={cn(
                          'truncate text-sm',
                          isQualifying && 'font-medium',
                          isHighlighted && 'font-medium'
                        )}
                      >
                        {compact ? row.team.short_name ?? row.team.name : row.team.name}
                      </span>
                    </div>
                  </td>
                  <Td className="hidden sm:table-cell">{row.played}</Td>
                  <Td className="hidden sm:table-cell">{row.won}</Td>
                  <Td className="hidden sm:table-cell">{row.drawn}</Td>
                  <Td className="hidden sm:table-cell">{row.lost}</Td>
                  <Td className="hidden lg:table-cell">{row.goals_for}</Td>
                  <Td className="hidden lg:table-cell">{row.goals_against}</Td>
                  <td
                    className={cn(
                      'hidden px-1 py-2.5 text-center text-sm tabular-nums lg:table-cell',
                      row.goal_difference > 0 && 'text-success',
                      row.goal_difference < 0 && 'text-danger'
                    )}
                  >
                    {row.goal_difference > 0
                      ? `+${row.goal_difference}`
                      : row.goal_difference}
                  </td>
                  <td className="px-2 py-2.5 text-center text-sm font-medium tabular-nums">
                    {row.points}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!compact ? (
        <>
          {/* Legenda completa — só a partir de lg, onde todas as colunas existem */}
          <p className="hidden text-[10px] text-muted-foreground lg:block">
            J=Jogos, V=Vitórias, E=Empates, D=Derrotas, GM=Golos Marcados,
            GS=Golos Sofridos, DG=Diferença de Golos, Pts=Pontos
          </p>
          {/* Legenda reduzida — mobile/tablet (apenas colunas visíveis) */}
          <p className="text-[10px] text-muted-foreground sm:hidden">
            Pts=Pontos
          </p>
          <p className="hidden text-[10px] text-muted-foreground sm:block lg:hidden">
            J=Jogos, V=Vitórias, E=Empates, D=Derrotas, Pts=Pontos
          </p>
        </>
      ) : null}
    </div>
  )
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'py-2 text-center text-xs font-medium text-muted-foreground',
        className
      )}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <td
      className={cn('px-1 py-2.5 text-center text-sm tabular-nums', className)}
    >
      {children}
    </td>
  )
}
