import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarDays, CheckCircle, Play, Users } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { getTournamentById, getTournamentStats } from '@/lib/queries/tournaments'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Section } from '@/components/ui/section'
import { EmptyState } from '@/components/ui/empty-state'
import { ActivateTournamentButton } from '@/components/tournament/activate-tournament-button'

export const metadata: Metadata = {
  title: 'Torneio · Live Soccer',
}

export default async function TournamentOverviewPage({
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

  const stats = await getTournamentStats(tournamentId)
  const { match, scoring } = tournament.settings

  return (
    <div className="space-y-8">
      <PageHeader
        title={tournament.name}
        description={tournament.description ?? undefined}
      >
        {isAdmin ? (
          <>
            <Button variant="outline" asChild>
              <Link href={`/tournaments/${tournamentId}/edit`}>Editar</Link>
            </Button>
            {tournament.status === 'draft' ? (
              <ActivateTournamentButton tournamentId={tournamentId} />
            ) : null}
          </>
        ) : null}
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Equipas" value={stats.teams} icon={<Users />} />
        <StatCard label="Jogos" value={stats.matches} icon={<CalendarDays />} />
        <StatCard label="Em curso" value={stats.active_matches} icon={<Play />} />
        <StatCard
          label="Concluídos"
          value={stats.finished_matches}
          icon={<CheckCircle />}
        />
      </div>

      <Section title="Próximos jogos">
        <div className="rounded-xl border-subtle bg-surface-1">
          <EmptyState
            icon={<CalendarDays />}
            title="Sem jogos agendados"
            description="Quando criares jogos, os próximos aparecerão aqui."
          />
        </div>
      </Section>

      {isAdmin ? (
        <Section
          title="Configurações do torneio"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/tournaments/${tournamentId}/edit`}>
                Editar configurações
              </Link>
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-surface-2 p-4 sm:grid-cols-4">
            <SettingItem
              label="Duração de cada parte"
              value={`${match.half_duration_minutes} min`}
            />
            <SettingItem
              label="Máx. faltas / parte"
              value={match.max_fouls_per_team_per_half}
            />
            <SettingItem
              label="Pontos por vitória"
              value={scoring.points_win}
            />
            <SettingItem
              label="Pontos por empate"
              value={scoring.points_draw}
            />
          </div>
        </Section>
      ) : null}
    </div>
  )
}

function SettingItem({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}
