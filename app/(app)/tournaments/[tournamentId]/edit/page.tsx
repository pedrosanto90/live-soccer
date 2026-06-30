import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getTournamentById } from '@/lib/queries/tournaments'
import { parseTournamentSettings } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { TournamentForm } from '@/components/tournament/tournament-form'
import type { TournamentInput } from '@/lib/validations/tournament'

export const metadata: Metadata = {
  title: 'Editar torneio · Live Soccer',
}

export default async function EditTournamentPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>
}) {
  const { tournamentId } = await params

  const tournament = await getTournamentById(tournamentId)
  if (!tournament) {
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

  if (membership?.role !== 'admin') {
    redirect(`/tournaments/${tournamentId}`)
  }

  const settings = parseTournamentSettings(tournament.settings)
  const defaultValues: Partial<TournamentInput> = {
    name: tournament.name,
    description: tournament.description ?? '',
    visibility: tournament.visibility,
    starts_at: tournament.starts_at ? tournament.starts_at.slice(0, 10) : '',
    ends_at: tournament.ends_at ? tournament.ends_at.slice(0, 10) : '',
    multi_tier: tournament.multi_tier,
    tier_schedule: tournament.tier_schedule ?? {},
    ...settings,
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title="Editar torneio"
        description="Altera as configurações do torneio."
      />
      <TournamentForm defaultValues={defaultValues} tournamentId={tournament.id} />
    </div>
  )
}
