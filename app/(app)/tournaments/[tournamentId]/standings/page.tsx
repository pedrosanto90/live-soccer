import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getTournamentById } from '@/lib/queries/tournaments'
import { getStandingsByTournament } from '@/lib/queries/standings'
import { PageHeader } from '@/components/ui/page-header'
import { StandingsView } from '@/components/standings/standings-view'

export const metadata: Metadata = {
  title: 'Classificação · Live Soccer',
}

// Nº de equipas apuradas por grupo (linha divisória visual). Ainda não é
// configurável no torneio — assume-se 2 por defeito.
const QUALIFYING_SPOTS = 2

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>
}) {
  const { tournamentId } = await params

  const tournament = await getTournamentById(tournamentId)
  if (!tournament) {
    notFound()
  }

  const phases = await getStandingsByTournament(tournamentId)

  return (
    <div className="space-y-8">
      <PageHeader title="Classificação" />
      <StandingsView
        phases={phases}
        tiebreakOrder={tournament.settings.tiebreak_order}
        qualifyingSpots={QUALIFYING_SPOTS}
      />
    </div>
  )
}
