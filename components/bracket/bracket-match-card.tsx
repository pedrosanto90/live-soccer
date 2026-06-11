'use client'

import { cn } from '@/lib/utils'
import type { BracketMatchRow, BracketTeamLite } from '@/lib/queries/bracket'

interface BracketMatchCardProps {
  match: BracketMatchRow
  onClick?: () => void
}

// Cartão de um jogo do bracket — duas linhas (casa/fora) com nome e resultado.
// O vencedor fica destacado; o perdedor esbatido. Slots por preencher mostram
// "A definir".
export function BracketMatchCard({ match, onClick }: BracketMatchCardProps) {
  const showScore = match.status !== 'scheduled'
  const decided = match.winner_team_id != null
  const clickable = onClick != null && match.home_team != null && match.away_team != null

  const rows: Array<{ team: BracketTeamLite | null; score: number }> = [
    { team: match.home_team, score: match.home_score },
    { team: match.away_team, score: match.away_score },
  ]

  return (
    <div
      data-testid="bracket-match"
      onClick={clickable ? onClick : undefined}
      className={cn(
        'w-44 overflow-hidden rounded-lg border border-border bg-card transition-colors',
        clickable && 'cursor-pointer hover:border-muted-foreground/40'
      )}
    >
      {rows.map(({ team, score }, i) => {
        const won = decided && team != null && team.id === match.winner_team_id
        const lost = decided && (team == null || team.id !== match.winner_team_id)
        return (
          <div
            key={i}
            className={cn(
              'flex items-center gap-2 px-2.5 py-1.5',
              i === 0 && 'border-b border-border',
              won && 'bg-surface-2',
              lost && 'opacity-50'
            )}
          >
            <span
              className={cn(
                'flex-1 truncate text-xs',
                team ? 'text-foreground' : 'italic text-muted-foreground'
              )}
            >
              {team ? team.short_name ?? team.name : 'A definir'}
            </span>
            {showScore ? (
              <span
                className={cn(
                  'flex-shrink-0 text-xs tabular-nums',
                  won ? 'font-medium text-foreground' : 'text-muted-foreground'
                )}
              >
                {score}
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
