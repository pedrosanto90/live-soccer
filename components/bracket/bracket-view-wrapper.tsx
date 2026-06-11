'use client'

import { useRouter } from 'next/navigation'

import { useBracketRealtime } from '@/hooks/use-bracket-realtime'
import type { BracketMatchRow } from '@/lib/queries/bracket'
import { BracketView } from './bracket-view'

interface BracketViewWrapperProps {
  phaseId: string
  initialMatches: BracketMatchRow[]
  isAdmin: boolean
  // Necessário para navegar para o painel de admin do jogo (modo admin).
  tournamentId?: string
}

// Liga o `BracketView` ao Realtime e decide o que fazer ao clicar num jogo:
// no modo admin navega para o painel de administração; no modo público abre o
// painel público numa nova aba. Slots por preencher não são clicáveis.
export function BracketViewWrapper({
  phaseId,
  initialMatches,
  isAdmin,
  tournamentId,
}: BracketViewWrapperProps) {
  const router = useRouter()
  const matches = useBracketRealtime(phaseId, initialMatches)

  function handleMatchClick(matchId: string) {
    const match = matches.find((m) => m.id === matchId)
    if (!match || !match.home_team || !match.away_team) return

    if (isAdmin && tournamentId) {
      router.push(`/tournaments/${tournamentId}/matches/${matchId}`)
    } else {
      window.open(`/match/${matchId}/public`, '_blank', 'noopener')
    }
  }

  return <BracketView matches={matches} onMatchClick={handleMatchClick} />
}
