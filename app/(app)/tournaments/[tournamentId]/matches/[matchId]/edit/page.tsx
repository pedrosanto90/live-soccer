import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getMatchById, getRefereesByTournament } from '@/lib/queries/matches'
import { getPhasesByTournament } from '@/lib/queries/phases'
import { getTeamsByTournament } from '@/lib/queries/teams'
import { PageHeader } from '@/components/ui/page-header'
import { MatchForm, type MatchFormPhase } from '@/components/match/match-form'
import type { MatchInput } from '@/lib/validations/match'

export const metadata: Metadata = {
  title: 'Editar jogo · Live Soccer',
}

export default async function EditMatchPage({
  params,
}: {
  params: Promise<{ tournamentId: string; matchId: string }>
}) {
  const { tournamentId, matchId } = await params

  const match = await getMatchById(matchId)
  if (!match || match.tournament_id !== tournamentId) {
    notFound()
  }

  // Só é possível editar jogos por iniciar.
  if (match.status !== 'scheduled') {
    redirect(`/tournaments/${tournamentId}/matches/${matchId}`)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: membership } = user
    ? await supabase
        .from('tournament_members')
        .select('role')
        .eq('tournament_id', tournamentId)
        .eq('profile_id', user.id)
        .maybeSingle()
    : { data: null }

  if (membership?.role !== 'admin' && membership?.role !== 'operator') {
    redirect(`/tournaments/${tournamentId}/matches/${matchId}`)
  }

  const [phasesRaw, teams, referees] = await Promise.all([
    getPhasesByTournament(tournamentId),
    getTeamsByTournament(tournamentId),
    getRefereesByTournament(tournamentId),
  ])

  const phases: MatchFormPhase[] = phasesRaw.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    groups: p.groups.map((g) => ({ id: g.id, name: g.name })),
  }))

  const defaultValues: Partial<MatchInput> = {
    phase_id: match.phase_id,
    group_id: match.group_id,
    home_team_id: match.home_team_id ?? undefined,
    away_team_id: match.away_team_id ?? undefined,
    referee_id: match.referee_id,
    venue: match.venue,
    scheduled_at: match.scheduled_at,
    settings_override: match.settings_override,
  }

  return (
    <div className="max-w-lg space-y-8">
      <PageHeader title="Editar jogo" />
      <MatchForm
        tournamentId={tournamentId}
        phases={phases}
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        referees={referees}
        defaultValues={defaultValues}
        matchId={match.id}
      />
    </div>
  )
}
