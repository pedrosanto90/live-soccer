import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink, MapPin, Pencil } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { getMatchById } from '@/lib/queries/matches'
import { formatMatchDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { StatusBadge } from '@/components/ui/status-badge'
import { TeamAvatar } from '@/components/match/team-avatar'

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

  const { match: settings } = match.effective_settings
  const isCustom = match.settings_override != null
  const base = `/tournaments/${tournamentId}/matches/${matchId}`

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            {match.phase.name}
            {match.group ? ` · ${match.group.name}` : ''}
          </p>
          <h1 className="mt-0.5 text-xl font-medium">
            {match.home_team.name} vs {match.away_team.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <StatusBadge status={match.status} />
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

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a
              href={`/match/${match.id}/public`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-3.5" />
              Painel público
            </a>
          </Button>
          {match.status === 'scheduled' && isAdmin ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`${base}/edit`}>
                <Pencil className="size-3.5" />
                Editar
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-8">
        <div className="grid grid-cols-3 items-center gap-4">
          <div className="flex flex-col items-center gap-3">
            <TeamAvatar team={match.home_team} className="size-14 text-lg" />
            <p className="text-center text-sm font-medium">{match.home_team.name}</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            {match.status === 'scheduled' ? (
              <p className="text-4xl font-medium text-muted-foreground">vs</p>
            ) : (
              <p className="text-5xl font-medium tabular-nums">
                {match.home_score} — {match.away_score}
              </p>
            )}
          </div>

          <div className="flex flex-col items-center gap-3">
            <TeamAvatar team={match.away_team} className="size-14 text-lg" />
            <p className="text-center text-sm font-medium">{match.away_team.name}</p>
          </div>
        </div>
      </div>

      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface-2 p-6">
        <p className="text-sm text-muted-foreground">
          O painel de administração do jogo será implementado em breve.
        </p>
        {match.status === 'scheduled' && isAdmin ? (
          <Button disabled>Iniciar jogo</Button>
        ) : null}
      </div>

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
          <SettingItem label="Máx. faltas / parte" value={settings.max_fouls_per_team_per_half} />
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
