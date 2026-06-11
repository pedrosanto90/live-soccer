import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getPhasesByTournament } from '@/lib/queries/phases'
import { getTeamsByTournament } from '@/lib/queries/teams'
import { getRefereesByTournament } from '@/lib/queries/matches'
import { PageHeader } from '@/components/ui/page-header'
import { MatchForm, type MatchFormPhase } from '@/components/match/match-form'

export const metadata: Metadata = {
  title: 'Criar jogo · Live Soccer',
}

export default async function NewMatchPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>
}) {
  const { tournamentId } = await params

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
    redirect(`/tournaments/${tournamentId}/matches`)
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

  return (
    <div className="max-w-lg space-y-8">
      <PageHeader
        title="Criar jogo"
        description="Cria um jogo adicional fora do sorteio automático."
      />
      <MatchForm
        tournamentId={tournamentId}
        phases={phases}
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        referees={referees}
      />
    </div>
  )
}
