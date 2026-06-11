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

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
      <div className="w-28 shrink-0">
        <StatusBadge status={match.status} size="sm" />
        {match.scheduled_at ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {formatMatchDate(match.scheduled_at)}
          </p>
        ) : null}
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">
        <span className="truncate text-sm font-medium">{match.home_team.name}</span>
        <TeamAvatar team={match.home_team} />
      </div>

      <div className="w-16 shrink-0 text-center">
        {match.status === 'scheduled' ? (
          <span className="text-sm text-muted-foreground">vs</span>
        ) : (
          <span className="text-base font-medium tabular-nums">
            {match.home_score} — {match.away_score}
          </span>
        )}
      </div>

      <div className="flex flex-1 items-center gap-2">
        <TeamAvatar team={match.away_team} />
        <span className="truncate text-sm font-medium">{match.away_team.name}</span>
      </div>

      {isLive ? (
        <a
          href={`/match/${match.id}/public`}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center gap-1 text-xs text-primary"
        >
          <Radio className="size-3 animate-pulse text-danger" /> Ao vivo
        </a>
      ) : null}
    </div>
  )
}
