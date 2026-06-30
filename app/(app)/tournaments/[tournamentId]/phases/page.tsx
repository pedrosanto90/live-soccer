import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { getTournamentById } from '@/lib/queries/tournaments'
import { getPhasesByTournament } from '@/lib/queries/phases'
import type { Tier } from '@/lib/tiers'
import { PhasesList } from '@/components/phase/phases-list'

export const metadata: Metadata = {
  title: 'Fases · Live Soccer',
}

export default async function PhasesPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>
}) {
  const { tournamentId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let isAdmin = false
  if (user) {
    const { data: membership } = await supabase
      .from('tournament_members')
      .select('role')
      .eq('tournament_id', tournamentId)
      .eq('profile_id', user.id)
      .maybeSingle()
    isAdmin = membership?.role === 'admin'
  }

  const [tournament, phases, teamsData] = await Promise.all([
    getTournamentById(tournamentId),
    getPhasesByTournament(tournamentId),
    supabase
      .from('teams')
      .select('id, name, tier')
      .eq('tournament_id', tournamentId)
      .order('name', { ascending: true }),
  ])

  const teams = (teamsData.data ?? []) as {
    id: string
    name: string
    tier: Tier
  }[]
  // A estrutura só é editável enquanto o torneio está em rascunho ou activo.
  const canManage =
    tournament?.status === 'draft' || tournament?.status === 'active'

  return (
    <PhasesList
      tournamentId={tournamentId}
      phases={phases}
      teams={teams}
      isAdmin={isAdmin}
      canManage={canManage}
      multiTier={tournament?.multi_tier ?? false}
    />
  )
}
