import { Radio } from 'lucide-react'

import type { MatchWithRelations } from '@/lib/queries/matches'
import { formatMatchDate } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'
import { TeamAvatar } from '@/components/match/team-avatar'

interface PublicMatchRowProps {
  match: MatchWithRelations
}

const LIVE_STATUSES = ['in_progress', 'half_time', 'extra_time', 'penalties']

// Versão pública (apenas leitura) do MatchRow. Liga ao painel público do jogo
// quando está a decorrer.
export function PublicMatchRow({ match }: PublicMatchRowProps) {
  const isLive = LIVE_STATUSES.includes(match.status)

  // A lista pública não inclui jogos de bracket por preencher, mas mantemos a
  // guarda para não rebentar caso uma equipa venha a null.
  if (!match.home_team || !match.away_team) return null

  return (
    <div className="rounded-lg border border-border bg-card p-3 sm:px-4 sm:py-3">
      {/* Linha estado/data + link "ao vivo" — só mobile */}
      <div className="mb-2 flex items-center justify-between sm:hidden">
        <StatusBadge status={match.status} size="sm" />
        {isLive ? (
          <a
            href={`/match/${match.id}/public`}
            target="_blank"
            rel="noreferrer"
            className="flex shrink-0 items-center gap-1 text-xs text-primary"
          >
            <Radio className="size-3 animate-pulse text-danger" /> Ao vivo
          </a>
        ) : match.scheduled_at ? (
          <p className="text-[10px] text-muted-foreground">
            {formatMatchDate(match.scheduled_at)}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="hidden w-28 shrink-0 sm:block">
          <StatusBadge status={match.status} size="sm" />
          {match.scheduled_at ? (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {formatMatchDate(match.scheduled_at)}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
          <span className="truncate text-xs font-medium sm:text-sm">
            {match.home_team.name}
          </span>
          <TeamAvatar team={match.home_team} />
        </div>

        <div className="w-12 shrink-0 text-center sm:w-16">
          {match.status === 'scheduled' ? (
            <span className="text-sm text-muted-foreground">vs</span>
          ) : (
            <span className="text-sm font-medium tabular-nums sm:text-base">
              {match.home_score} — {match.away_score}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          <TeamAvatar team={match.away_team} />
          <span className="truncate text-xs font-medium sm:text-sm">
            {match.away_team.name}
          </span>
        </div>

        {isLive ? (
          <a
            href={`/match/${match.id}/public`}
            target="_blank"
            rel="noreferrer"
            className="hidden shrink-0 items-center gap-1 text-xs text-primary sm:flex"
          >
            <Radio className="size-3 animate-pulse text-danger" /> Ao vivo
          </a>
        ) : null}
      </div>
    </div>
  )
}
