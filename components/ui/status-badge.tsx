import type { MatchStatus, TournamentStatus } from '@/types/database'

import { cn } from '@/lib/utils'

type Status = TournamentStatus | MatchStatus

interface StatusBadgeProps {
  status: Status
  size?: 'sm' | 'md'
  className?: string
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'bg-surface-2 text-muted-foreground' },
  active: { label: 'Activo', className: 'bg-success-bg text-success' },
  finished: { label: 'Terminado', className: 'bg-info-bg text-info' },
  cancelled: { label: 'Cancelado', className: 'bg-danger-bg text-danger' },
  scheduled: { label: 'Agendado', className: 'bg-surface-2 text-muted-foreground' },
  in_progress: { label: 'Em curso', className: 'bg-indigo-50 text-indigo-600' },
  half_time: { label: 'Intervalo', className: 'bg-warning-bg text-warning' },
  extra_time: { label: 'Prolongamento', className: 'bg-indigo-50 text-indigo-600' },
  penalties: { label: 'Penáltis', className: 'bg-indigo-50 text-indigo-600' },
}

const sizeClasses = {
  sm: 'text-[10px] leading-[14px] px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
} as const

export function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        config.className,
        sizeClasses[size],
        className
      )}
    >
      {config.label}
    </span>
  )
}
