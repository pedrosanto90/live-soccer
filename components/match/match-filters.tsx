'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TIER_LABELS, type Tier } from '@/lib/tiers'
import type { MatchStatus } from '@/types/database'

interface PhaseOption {
  id: string
  name: string
}

interface MatchFiltersProps {
  phases: PhaseOption[]
  currentFilters: { phase_id?: string; status?: MatchStatus; tier?: Tier }
  // Só os torneios multi-escalão mostram o filtro de escalão.
  isMultiTier?: boolean
  availableTiers?: Tier[]
}

const ALL = 'all'
const STATUS_OPTIONS: MatchStatus[] = ['scheduled', 'in_progress', 'finished']

export function MatchFilters({
  phases,
  currentFilters,
  isMultiTier = false,
  availableTiers = [],
}: MatchFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const hasFilters = Boolean(
    currentFilters.phase_id || currentFilters.status || currentFilters.tier
  )

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function handleStatusChange(status: MatchStatus) {
    // Clicar no estado já activo limpa o filtro.
    setParam('status', currentFilters.status === status ? null : status)
  }

  function clearFilters() {
    router.push(pathname)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={currentFilters.phase_id ?? ALL}
        onValueChange={(v) => setParam('phase', v === ALL ? null : v)}
      >
        <SelectTrigger className="w-48" data-testid="filter-phase">
          <SelectValue placeholder="Todas as fases" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas as fases</SelectItem>
          {phases.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isMultiTier && availableTiers.length > 0 ? (
        <Select
          value={currentFilters.tier ?? ALL}
          onValueChange={(v) => setParam('tier', v === ALL ? null : v)}
        >
          <SelectTrigger className="w-48" data-testid="filter-tier">
            <SelectValue placeholder="Todos os escalões" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os escalões</SelectItem>
            {availableTiers.map((tier) => (
              <SelectItem key={tier} value={tier}>
                {TIER_LABELS[tier]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {STATUS_OPTIONS.map((status) => (
        <Button
          key={status}
          variant={currentFilters.status === status ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleStatusChange(status)}
          data-testid={`filter-status-${status}`}
        >
          <StatusBadge status={status} size="sm" className="bg-transparent" />
        </Button>
      ))}

      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="size-3.5" />
          Limpar
        </Button>
      ) : null}
    </div>
  )
}
