import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import {
  getMatchById,
  getMatchEvents,
  getMatchPenalties,
} from '@/lib/queries/matches'
import { MatchProvider } from '@/contexts/match-context'
import { MatchPublicPanel } from '@/components/match/match-public-panel'

export const metadata: Metadata = {
  title: 'Painel ao vivo · Live Soccer',
}

export default async function PublicMatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>
}) {
  const { matchId } = await params

  const match = await getMatchById(matchId)
  // Sem ambas as equipas (slot de bracket por preencher) não há painel a mostrar.
  if (!match || !match.home_team || !match.away_team) {
    notFound()
  }

  const [events, penalties] = await Promise.all([
    getMatchEvents(matchId),
    getMatchPenalties(matchId),
  ])

  return (
    <MatchProvider
      initialMatch={match}
      initialEvents={events}
      initialPenalties={penalties}
    >
      <MatchPublicPanel
        homeTeam={match.home_team}
        awayTeam={match.away_team}
        tournamentName={match.tournament.name}
        phaseName={match.phase.name}
        groupName={match.group?.name ?? null}
        settings={match.effective_settings}
      />
    </MatchProvider>
  )
}
