import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getTeamById } from '@/lib/queries/teams'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { PlayerList } from '@/components/team/player-list'

export const metadata: Metadata = {
  title: 'Equipa · Live Soccer',
}

export default async function TeamDetailPage({
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

  const initials = team.short_name ?? team.name.slice(0, 2).toUpperCase()

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div
          className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border"
          style={{ background: team.color_primary }}
        >
          <span
            className="text-lg font-medium"
            style={{ color: team.color_secondary }}
          >
            {initials}
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-medium">{team.name}</h1>
          {team.short_name ? (
            <p className="text-sm text-muted-foreground">{team.short_name}</p>
          ) : null}
        </div>
        {isAdmin ? (
          <Button variant="outline" asChild className="ml-auto">
            <Link href={`/tournaments/${tournamentId}/teams/${teamId}/edit`}>
              Editar equipa
            </Link>
          </Button>
        ) : null}
      </div>

      <Section title="Jogadores">
        <PlayerList players={team.players} teamId={teamId} isAdmin={isAdmin} />
      </Section>
    </div>
  )
}
