'use client'

import { Hand } from 'lucide-react'

import {
  getRoundLabel,
  isThirdPlaceMatch,
  THIRD_PLACE_LABEL,
} from '@/lib/bracket'
import type { BracketMatchRow } from '@/lib/queries/bracket'
import { BracketMatchCard } from './bracket-match-card'

interface BracketViewProps {
  matches: BracketMatchRow[]
  onMatchClick?: (matchId: string) => void
}

interface RoundColumn {
  key: string
  label: string
  matches: BracketMatchRow[]
}

// Agrupa os jogos por ronda (do maior round para o menor: quartos → meias →
// final) e ordena cada ronda por posição. O jogo de 3.º/4.º lugar é separado
// numa coluna própria, colocada depois da final.
function toColumns(matches: BracketMatchRow[]): RoundColumn[] {
  const tree = matches.filter(
    (m) => !isThirdPlaceMatch(m.bracket_round, m.bracket_position)
  )
  const thirdPlace = matches.filter((m) =>
    isThirdPlaceMatch(m.bracket_round, m.bracket_position)
  )

  const byRound = new Map<number, BracketMatchRow[]>()
  for (const m of tree) {
    const list = byRound.get(m.bracket_round) ?? []
    list.push(m)
    byRound.set(m.bracket_round, list)
  }
  const columns: RoundColumn[] = [...byRound.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([round, list]) => ({
      key: `round-${round}`,
      label: getRoundLabel(round),
      matches: list.sort((a, b) => a.bracket_position - b.bracket_position),
    }))

  if (thirdPlace.length > 0) {
    columns.push({
      key: 'third-place',
      label: THIRD_PLACE_LABEL,
      matches: thirdPlace,
    })
  }
  return columns
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
          <div key={column.key} className="flex min-w-44 flex-1 flex-col">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {column.label}
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
