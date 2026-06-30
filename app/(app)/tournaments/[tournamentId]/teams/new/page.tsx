import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { TeamForm } from '@/components/team/team-form'

export const metadata: Metadata = {
  title: 'Adicionar equipa · Live Soccer',
}

export default async function NewTeamPage({
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
    redirect(`/tournaments/${tournamentId}/teams`)
  }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('multi_tier')
    .eq('id', tournamentId)
    .maybeSingle()

  return (
    <div className="max-w-lg space-y-8">
      <PageHeader title="Adicionar equipa" />
      <TeamForm
        tournamentId={tournamentId}
        multiTier={tournament?.multi_tier ?? false}
      />
    </div>
  )
}
