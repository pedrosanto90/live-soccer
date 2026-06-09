'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'
import type { TournamentStatus } from '@/types/database'

interface TournamentNavProps {
  tournamentId: string
  name: string
  status: TournamentStatus
}

export function TournamentNav({ tournamentId, name, status }: TournamentNavProps) {
  const pathname = usePathname()
  const base = `/tournaments/${tournamentId}`

  const tabs = [
    { label: 'Visão geral', href: base },
    { label: 'Equipas', href: `${base}/teams` },
    { label: 'Fases', href: `${base}/phases` },
    { label: 'Jogos', href: `${base}/matches` },
    { label: 'Classificação', href: `${base}/standings` },
  ]

  function isActive(href: string) {
    if (href === base) return pathname === base
    return pathname.startsWith(href)
  }

  return (
    <div className="border-b border-border">
      <div className="w-full">
        <div className="flex items-center gap-2 pb-3 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">
            Dashboard
          </Link>
          <span>/</span>
          <span className="font-medium text-foreground">{name}</span>
        </div>

        <div className="flex items-center justify-between">
          <nav className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors',
                  isActive(tab.href)
                    ? 'border-foreground font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <div className="shrink-0 pb-2">
            <StatusBadge status={status} />
          </div>
        </div>
      </div>
    </div>
  )
}
