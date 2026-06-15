'use client'

import { Hand } from 'lucide-react'

import { getRoundLabel } from '@/lib/bracket'
import type { BracketMatchRow } from '@/lib/queries/bracket'
import { BracketMatchCard } from './bracket-match-card'

interface BracketViewProps {
  matches: BracketMatchRow[]
  onMatchClick?: (matchId: string) => void
}

interface RoundColumn {
  round: number
  matches: BracketMatchRow[]
}

// Agrupa os jogos por ronda (do maior round para o menor: quartos → meias →
// final) e ordena cada ronda por posição.
function toColumns(matches: BracketMatchRow[]): RoundColumn[] {
  const byRound = new Map<number, BracketMatchRow[]>()
  for (const m of matches) {
    const list = byRound.get(m.bracket_round) ?? []
    list.push(m)
    byRound.set(m.bracket_round, list)
  }
  return [...byRound.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([round, list]) => ({
      round,
      matches: list.sort((a, b) => a.bracket_position - b.bracket_position),
    }))
}

// Vista do bracket em colunas. O espaçamento vertical (`justify-around`) dá a
// leitura em árvore sem desenhar linhas — robusto em qualquer largura e fiel ao
// design system.
export function BracketView({ matches, onMatchClick }: BracketViewProps) {
  const columns = toColumns(matches)

  if (columns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ainda não há jogos no bracket.
      </p>
    )
  }

  return (
    <div>
      <div className="flex gap-4 overflow-x-auto pb-2 sm:gap-6">
        {columns.map((column) => (
          <div key={column.round} className="flex min-w-44 flex-1 flex-col">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {getRoundLabel(column.round)}
            </p>
            <div className="flex flex-1 flex-col justify-around gap-4">
              {column.matches.map((match) => (
                <BracketMatchCard
                  key={match.id}
                  match={match}
                  onClick={onMatchClick ? () => onMatchClick(match.id) : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {columns.length > 1 ? (
        <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-muted-foreground sm:hidden">
          <Hand className="size-3" /> Arrasta para navegar no bracket
        </p>
      ) : null}
    </div>
  )
}
