import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'

import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

const trendConfig = {
  up: { Icon: ArrowUpRight, className: 'text-success' },
  down: { Icon: ArrowDownRight, className: 'text-danger' },
  neutral: { Icon: ArrowRight, className: 'text-muted-foreground' },
} as const

export function StatCard({ label, value, icon, trend, className }: StatCardProps) {
  const trendInfo = trend ? trendConfig[trend] : null

  return (
    <div className={cn('rounded-lg bg-surface-2 p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {icon ? (
          <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
        ) : null}
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-3xl font-medium tracking-tight">{value}</span>
        {trendInfo ? (
          <trendInfo.Icon className={cn('size-4', trendInfo.className)} />
        ) : null}
      </div>
    </div>
  )
}
