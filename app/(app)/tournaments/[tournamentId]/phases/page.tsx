import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/queries/auth'
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

  // Lança já as queries independentes do utilizador para correrem em paralelo
  // com a resolução do user + membership (que são sequenciais entre si).
  const tournamentPromise = getTournamentById(tournamentId)
  const phasesPromise = getPhasesByTournament(tournamentId)
  const teamsPromise = supabase
    .from('teams')
    .select('id, name, tier')
    .eq('tournament_id', tournamentId)
    .order('name', { ascending: true })

  const adminPromise = getCurrentUser().then(async (user) => {
    if (!user) return false
    const { data: membership } = await supabase
      .from('tournament_members')
      .select('role')
      .eq('tournament_id', tournamentId)
      .eq('profile_id', user.id)
      .maybeSingle()
    return membership?.role === 'admin'
  })

  const [tournament, phases, teamsData, isAdmin] = await Promise.all([
    tournamentPromise,
    phasesPromise,
    teamsPromise,
    adminPromise,
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
