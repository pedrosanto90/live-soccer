import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getMatchById } from '@/lib/queries/matches'
import { StatusBadge } from '@/components/ui/status-badge'
import { TeamAvatar } from '@/components/match/team-avatar'

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
  if (!match) {
    notFound()
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-4">
      <div className="text-center">
        <p className="text-sm font-medium">{match.tournament.name}</p>
        <p className="text-xs text-muted-foreground">
          {match.phase.name}
          {match.group ? ` · ${match.group.name}` : ''}
        </p>
      </div>

      <div className="grid w-full max-w-md grid-cols-3 items-center gap-4">
        <div className="flex flex-col items-center gap-3">
          <TeamAvatar team={match.home_team} className="size-14 text-lg" />
          <p className="text-center text-sm font-medium">{match.home_team.name}</p>
        </div>

        <div className="flex flex-col items-center">
          {match.status === 'scheduled' ? (
            <p className="text-4xl font-medium text-muted-foreground">vs</p>
          ) : (
            <p className="text-5xl font-medium tabular-nums">
              {match.home_score} — {match.away_score}
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-3">
          <TeamAvatar team={match.away_team} className="size-14 text-lg" />
          <p className="text-center text-sm font-medium">{match.away_team.name}</p>
        </div>
      </div>

      <StatusBadge status={match.status} />

      <p className="text-xs text-muted-foreground">
        O painel ao vivo estará disponível em breve.
      </p>
    </div>
  )
}
