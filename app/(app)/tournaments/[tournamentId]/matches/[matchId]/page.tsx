import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, Pencil } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import {
  getActivePlayers,
  getMatchById,
  getMatchEvents,
  getMatchPenalties,
} from '@/lib/queries/matches'
import { formatMatchDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { MatchProvider } from '@/contexts/match-context'
import { MatchAdminPanel } from '@/components/match/match-admin-panel'

export const metadata: Metadata = {
  title: 'Jogo · Live Soccer',
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ tournamentId: string; matchId: string }>
}) {
  const { tournamentId, matchId } = await params

  const match = await getMatchById(matchId)
  if (!match || match.tournament_id !== tournamentId) {
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

  const [events, penalties, homePlayers, awayPlayers] = await Promise.all([
    getMatchEvents(matchId),
    getMatchPenalties(matchId),
    getActivePlayers(match.home_team_id ?? ''),
    getActivePlayers(match.away_team_id ?? ''),
  ])

  const { match: settings } = match.effective_settings
  const isCustom = match.settings_override != null
  const base = `/tournaments/${tournamentId}/matches/${matchId}`
  // Jogo de bracket ainda à espera dos vencedores das rondas anteriores: não há
  // equipas para gerir, mostra-se só o cabeçalho e uma nota.
  const homeTeam = match.home_team
  const awayTeam = match.away_team
  const teamsReady = homeTeam != null && awayTeam != null

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            {match.phase.name}
            {match.group ? ` · ${match.group.name}` : ''}
          </p>
          <h1 className="mt-0.5 text-xl font-medium">
            {homeTeam?.name ?? 'A definir'} vs {awayTeam?.name ?? 'A definir'}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            {match.scheduled_at ? (
              <p className="text-sm text-muted-foreground">
                {formatMatchDate(match.scheduled_at)}
              </p>
            ) : null}
            {match.venue ? (
              <p className="text-sm text-muted-foreground">
                <MapPin className="mr-1 inline size-3.5" />
                {match.venue}
              </p>
            ) : null}
          </div>
        </div>

        {match.status === 'scheduled' && isAdmin && match.bracket_round == null ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`${base}/edit`}>
              <Pencil className="size-3.5" />
              Editar
            </Link>
          </Button>
        ) : null}
      </div>

      {teamsReady ? (
        <MatchProvider
          initialMatch={match}
          initialEvents={events}
          initialPenalties={penalties}
        >
          <MatchAdminPanel
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            players={{ home: homePlayers, away: awayPlayers }}
            settings={match.effective_settings}
            isAdmin={isAdmin}
            publicHref={`/match/${match.id}/placar`}
          />
        </MatchProvider>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          As equipas deste jogo são definidas após os jogos anteriores das
          eliminatórias. Podes agendá-lo a partir da lista de jogos.
        </div>
      )}

      <Section
        title="Configurações do jogo"
        action={
          isCustom ? (
            <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[10px] font-medium text-warning">
              Personalizadas
            </span>
          ) : undefined
        }
      >
        <div className="grid grid-cols-2 gap-4 rounded-lg bg-surface-2 p-4 sm:grid-cols-4">
          <SettingItem
            label="Duração de cada parte"
            value={`${settings.half_duration_minutes} min`}
          />
          <SettingItem
            label="Intervalo"
            value={`${settings.half_time_duration_minutes} min`}
          />
          <SettingItem
            label="Prolongamento"
            value={`${settings.extra_time_duration_minutes} min`}
          />
          <SettingItem
            label="Máx. faltas / parte"
            value={settings.max_fouls_per_team_per_half}
          />
          <SettingItem label="Penáltis (séries)" value={settings.penalty_shootout_kicks} />
        </div>
      </Section>
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
