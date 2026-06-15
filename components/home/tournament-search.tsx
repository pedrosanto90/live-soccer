'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, SlidersHorizontal, X } from 'lucide-react'

import type { TournamentStatus } from '@/types/database'
import type { PublicTournamentFilters } from '@/lib/queries/tournaments'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const STATUS_OPTIONS: { value?: TournamentStatus; label: string }[] = [
  { value: undefined, label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'finished', label: 'Terminados' },
  { value: 'draft', label: 'Em preparação' },
]

export function TournamentSearch({
  initialFilters,
}: {
  initialFilters: PublicTournamentFilters
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // O input de pesquisa é controlado localmente; a URL é actualizada com debounce.
  const [search, setSearch] = useState(initialFilters.search ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const currentStatus = searchParams.get('status') ?? undefined
  const startsAfter = searchParams.get('after') ?? ''
  const startsBefore = searchParams.get('before') ?? ''
  const hasDateFilter = Boolean(startsAfter || startsBefore)

  // Em mobile os filtros de data ficam colapsados; abrem já se houver datas
  // activas para não esconder filtros em uso.
  const [showDateFilters, setShowDateFilters] = useState(hasDateFilter)

  // Constrói a próxima URL a partir dos searchParams actuais, aplicando updates.
  // Mantém sempre o termo de pesquisa local para não o perder ao mexer noutros filtros.
  function pushWith(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    const merged = { search: search || undefined, ...updates }
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      pushWith({ search: value || undefined })
    }, 300)
  }

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  return (
    <div className="mb-8 flex flex-col gap-3">
      {/* Pesquisa por nome */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar torneios..."
          className="h-10 pl-9"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        {search && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
            aria-label="Limpar pesquisa"
            onClick={() => handleSearchChange('')}
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      {/* Filtros de estado */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground">Estado:</p>
        {STATUS_OPTIONS.map(({ value, label }) => (
          <Button
            key={label}
            size="sm"
            variant={currentStatus === value ? 'default' : 'outline'}
            onClick={() => pushWith({ status: value })}
          >
            {label}
          </Button>
        ))}
        {/* Alternar filtros de data — só mobile */}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto sm:hidden"
          onClick={() => setShowDateFilters((v) => !v)}
        >
          <SlidersHorizontal className="mr-1 size-3.5" />
          {showDateFilters ? 'Menos filtros' : 'Mais filtros'}
        </Button>
      </div>

      {/* Filtros de data */}
      <div
        className={cn(
          'flex-wrap items-center gap-2 sm:flex',
          showDateFilters ? 'flex' : 'hidden'
        )}
      >
        <p className="text-xs text-muted-foreground">Datas:</p>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={startsAfter}
            onChange={(e) => pushWith({ after: e.target.value || undefined })}
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={startsBefore}
            onChange={(e) => pushWith({ before: e.target.value || undefined })}
          />
        </div>
        {hasDateFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => pushWith({ after: undefined, before: undefined })}
          >
            <X className="mr-1 size-3.5" /> Limpar datas
          </Button>
        )}
      </div>
    </div>
  )
}
