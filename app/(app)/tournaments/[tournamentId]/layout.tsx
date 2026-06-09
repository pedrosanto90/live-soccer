import { notFound } from 'next/navigation'

import { getTournamentById } from '@/lib/queries/tournaments'
import { TournamentNav } from '@/components/tournament/tournament-nav'

export default async function TournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tournamentId: string }>
}) {
  const { tournamentId } = await params
  const tournament = await getTournamentById(tournamentId)

  if (!tournament) {
    notFound()
  }

  return (
    <div className="space-y-8">
      <TournamentNav
        tournamentId={tournament.id}
        name={tournament.name}
        status={tournament.status}
      />
      {children}
    </div>
  )
}
