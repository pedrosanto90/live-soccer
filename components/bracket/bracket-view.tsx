'use client'

import { useEffect, useRef, useState } from 'react'
import { Hand } from 'lucide-react'
import {
  SingleEliminationBracket,
  SVGViewer,
  type MatchComponentProps,
} from '@g-loot/react-tournament-brackets'

import { toBracketMatches, type LibraryMatch } from '@/lib/bracket'
import type { BracketMatchRow } from '@/lib/queries/bracket'
import { BracketMatchCard } from './bracket-match-card'

interface BracketViewProps {
  matches: BracketMatchRow[]
  onMatchClick?: (matchId: string) => void
}

// Dimensões da caixa de cada jogo (em coordenadas SVG). `boxHeight` cobre as
// duas linhas (casa/fora) do cartão; `width` espelha a largura w-44 antiga.
const BOX_WIDTH = 176
const BOX_HEIGHT = 56

// Vista do bracket de eliminatórias usando `@g-loot/react-tournament-brackets`,
// que trata das linhas de conexão, do espaçamento proporcional entre rondas e
// do pan/zoom. O cartão de cada jogo é o nosso `BracketMatchCard` (design
// system). O jogo de 3.º/4.º lugar — não suportado pela biblioteca — é
// renderizado à parte por baixo do quadro.
export function BracketView({ matches, onMatchClick }: BracketViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setContainerWidth(w)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (matches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ainda não há jogos no bracket.
      </p>
    )
  }

  const { mainMatches, thirdPlaceMatch } = toBracketMatches(matches)

  return (
    <div ref={containerRef} className="w-full overflow-hidden">
      <SingleEliminationBracket
        matches={mainMatches}
        matchComponent={({
          match,
          topParty,
          bottomParty,
          topWon,
          bottomWon,
        }: MatchComponentProps) => (
          <BracketMatchCard
            match={match}
            topParty={topParty}
            bottomParty={bottomParty}
            topWon={topWon}
            bottomWon={bottomWon}
            onSelect={onMatchClick}
          />
        )}
        svgWrapper={({ children, bracketWidth, bracketHeight, ...props }) => (
          <SVGViewer
            bracketWidth={bracketWidth}
            bracketHeight={bracketHeight}
            width={containerWidth}
            height={bracketHeight}
            SVGBackground="transparent"
            background="transparent"
            miniatureProps={{ position: 'none' }}
            {...props}
          >
            {children}
          </SVGViewer>
        )}
        options={{
          style: {
            width: BOX_WIDTH,
            boxHeight: BOX_HEIGHT,
            canvasPadding: 12,
            spaceBetweenColumns: 44,
            spaceBetweenRows: 24,
            connectorColor: 'var(--border)',
            connectorColorHighlight: 'var(--primary)',
            roundHeader: {
              isShown: true,
              backgroundColor: 'transparent',
              fontColor: 'var(--muted-foreground)',
              fontFamily: 'var(--font-inter, system-ui)',
              fontSize: 11,
            },
          },
        }}
      />

      {thirdPlaceMatch ? (
        <ThirdPlaceCard match={thirdPlaceMatch} onSelect={onMatchClick} />
      ) : null}

      <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-muted-foreground sm:hidden">
        <Hand className="size-3" /> Arrasta para navegar no bracket
      </p>
    </div>
  )
}

// Jogo de atribuição do 3.º lugar, mostrado por baixo do quadro principal.
function ThirdPlaceCard({
  match,
  onSelect,
}: {
  match: LibraryMatch
  onSelect?: (matchId: string) => void
}) {
  const [top, bottom] = match.participants
  return (
    <div className="mt-4 flex flex-col items-start gap-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {match.tournamentRoundText}
      </p>
      <div className="h-14 w-44">
        <BracketMatchCard
          match={match}
          topParty={top}
          bottomParty={bottom}
          topWon={top.isWinner}
          bottomWon={bottom.isWinner}
          onSelect={onSelect}
        />
      </div>
    </div>
  )
}
