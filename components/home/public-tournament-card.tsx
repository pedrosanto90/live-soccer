import Link from 'next/link'
import { ArrowRight, Calendar, Users } from 'lucide-react'

import type { PublicTournament } from '@/lib/queries/tournaments'
import { cn, formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'

export function PublicTournamentCard({
  tournament,
}: {
  tournament: PublicTournament
}) {
  const isActive = tournament.status === 'active'

  return (
    <Link
      href={`/t/${tournament.slug}`}
      data-testid="public-tournament-card"
      className="group block"
    >
      <div
        className={cn(
          'flex h-full flex-col gap-3 rounded-lg border bg-card p-5 transition-colors',
          isActive
            ? 'border-primary/40 hover:border-primary/60'
            : 'border-border hover:border-border/60'
        )}
      >
        {/* Topo — estado + data */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <StatusBadge status={tournament.status} size="sm" />
            {tournament.has_live_match && (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger-bg px-2 py-0.5 text-[10px] font-medium text-danger">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-danger" />
                </span>
                Ao vivo
              </span>
            )}
          </div>
          {tournament.starts_at && (
            <p className="text-xs text-muted-foreground">
              {formatDate(tournament.starts_at)}
            </p>
          )}
        </div>

        {/* Nome + descrição */}
        <div>
          <h2 className="text-base font-medium leading-snug">
            {tournament.name}
          </h2>
          {tournament.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {tournament.description}
            </p>
          )}
        </div>

        {/* Stats + CTA */}
        <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
          <div className="flex gap-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3.5" />
              {tournament.teams_count} equipas
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="size-3.5" />
              {tournament.matches_count} jogos
            </span>
          </div>
          <span className="flex items-center gap-1 text-xs font-medium text-primary">
            Ver torneio
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}
