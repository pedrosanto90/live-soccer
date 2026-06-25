'use client'

import { cn } from '@/lib/utils'

// Forma mínima e estruturalmente compatível tanto com o `MatchType`/
// `ParticipantType` que a biblioteca injecta no `matchComponent` como com o
// `LibraryMatch` que construímos para o jogo de 3.º/4.º lugar.
interface Party {
  id: string | number
  name?: string
  resultText?: string | null
}

// A biblioteca `@g-loot/react-tournament-brackets` injecta várias props no
// `matchComponent`; só usamos um subconjunto. `onSelect` é adicionado por nós
// (a biblioteca não o conhece) para encaminhar o clique no jogo.
interface BracketMatchCardProps {
  match: { id: string | number; state: string }
  topParty: Party
  bottomParty: Party
  topWon: boolean
  bottomWon: boolean
  onSelect?: (matchId: string) => void
}

// Cartão de um jogo do bracket — duas linhas (casa/fora) com nome e resultado.
// O vencedor fica destacado; o perdedor esbatido. Slots por preencher mostram
// "A definir". Renderizado dentro do `foreignObject` da biblioteca, preenchendo
// toda a caixa; reutilizado também para o jogo de 3.º/4.º lugar.
export function BracketMatchCard({
  match,
  topParty,
  bottomParty,
  topWon,
  bottomWon,
  onSelect,
}: BracketMatchCardProps) {
  const isLive = match.state === 'SCORE_DONE'
  const isPlayed = match.state === 'DONE'

  const nameOf = (p: Party) => p.name || 'A definir'
  const bothTeamsKnown =
    nameOf(topParty) !== 'A definir' && nameOf(bottomParty) !== 'A definir'
  const clickable = onSelect != null && bothTeamsKnown

  const rows: Array<{ party: Party; won: boolean }> = [
    { party: topParty, won: topWon },
    { party: bottomParty, won: bottomWon },
  ]

  return (
    <div
      data-testid="bracket-match"
      onClick={clickable ? () => onSelect(String(match.id)) : undefined}
      className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-lg border bg-card transition-colors',
        isLive ? 'border-primary' : 'border-border',
        clickable && 'cursor-pointer hover:border-muted-foreground/40'
      )}
    >
      {rows.map(({ party, won }, i) => {
        const name = nameOf(party)
        const isTbd = name === 'A definir'
        const lost = isPlayed && !won && !isTbd
        return (
          <div
            key={i}
            className={cn(
              'flex flex-1 items-center gap-2 px-2.5 py-1.5',
              i === 0 && 'border-b border-border',
              isPlayed && won && 'bg-surface-2',
              lost && 'opacity-50'
            )}
          >
            <span
              className={cn(
                'flex-1 truncate text-xs',
                isTbd ? 'italic text-muted-foreground' : 'text-foreground'
              )}
            >
              {name}
            </span>
            {party.resultText ? (
              <span
                className={cn(
                  'flex-shrink-0 text-xs tabular-nums',
                  won ? 'font-medium text-foreground' : 'text-muted-foreground'
                )}
              >
                {party.resultText}
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
