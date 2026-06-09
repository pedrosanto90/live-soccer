import { cn } from '@/lib/utils'

interface SectionProps {
  title?: string
  description?: string
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function Section({
  title,
  description,
  children,
  action,
  className,
}: SectionProps) {
  return (
    <section className={cn('flex flex-col gap-4', className)}>
      {title || action ? (
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            {title ? <h3>{title}</h3> : null}
            {description ? (
              <p className="text-sm text-muted-foreground text-balance">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}
