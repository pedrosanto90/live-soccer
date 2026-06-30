import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getTeamById } from '@/lib/queries/teams'
import { PageHeader } from '@/components/ui/page-header'
import { TeamForm } from '@/components/team/team-form'
import type { TeamInput } from '@/lib/validations/team'

export const metadata: Metadata = {
  title: 'Editar equipa · Live Soccer',
}

export default async function EditTeamPage({
  params,
}: {
  params: Promise<{ tournamentId: string; teamId: string }>
}) {
  const { tournamentId, teamId } = await params

  const team = await getTeamById(teamId)
  if (!team || team.tournament_id !== tournamentId) {
    notFound()
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
    redirect(`/tournaments/${tournamentId}/teams/${teamId}`)
  }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('multi_tier')
    .eq('id', tournamentId)
    .maybeSingle()

  const defaultValues: Partial<TeamInput> = {
    name: team.name,
    tier: team.tier,
    short_name: team.short_name ?? '',
    color_primary: team.color_primary,
    color_secondary: team.color_secondary,
  }

  return (
    <div className="max-w-lg space-y-8">
      <PageHeader title="Editar equipa" />
      <TeamForm
        tournamentId={tournamentId}
        defaultValues={defaultValues}
        teamId={team.id}
        multiTier={tournament?.multi_tier ?? false}
      />
    </div>
  )
}
