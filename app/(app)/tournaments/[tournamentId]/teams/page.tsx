import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { getTeamsByTournament } from '@/lib/queries/teams'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { TeamCard } from '@/components/team/team-card'

export const metadata: Metadata = {
  title: 'Equipas · Live Soccer',
}

export default async function TeamsPage({
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
    isAdmin = membership?.role === 'admin' || membership?.role === 'operator'
  }

  const teams = await getTeamsByTournament(tournamentId)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Equipas"
        description={`${teams.length} equipa(s) inscrita(s)`}
      >
        {isAdmin ? (
          <Button asChild data-testid="add-team">
            <Link href={`/tournaments/${tournamentId}/teams/new`}>
              <Plus className="size-4" />
              Adicionar equipa
            </Link>
          </Button>
        ) : null}
      </PageHeader>

      {teams.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="Ainda não há equipas"
          description="Adiciona as equipas que vão participar neste torneio."
          action={
            isAdmin ? (
              <Button asChild>
                <Link href={`/tournaments/${tournamentId}/teams/new`}>
                  Adicionar equipa
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              tournamentId={tournamentId}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  )
}
