import type { TournamentStatus } from '@/types/database'
import type { PublicTournamentFilters } from '@/lib/queries/tournaments'

// searchParams chegam como string | string[] | undefined.
type SearchParams = Record<string, string | string[] | undefined>

const VALID_STATUS: TournamentStatus[] = [
  'draft',
  'active',
  'finished',
  'cancelled',
]

// Normaliza um valor de searchParam para uma string não vazia (ou undefined).
function str(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  const trimmed = raw?.trim()
  return trimmed ? trimmed : undefined
}

// Constrói os filtros de torneios a partir dos searchParams da URL.
// Estados desconhecidos são ignorados (tratados como "sem filtro").
export function parseTournamentFilters(
  params: SearchParams
): PublicTournamentFilters {
  const statusRaw = str(params.status)
  const status =
    statusRaw && (VALID_STATUS as string[]).includes(statusRaw)
      ? (statusRaw as TournamentStatus)
      : undefined

  return {
    search: str(params.search),
    status,
    starts_after: str(params.after),
    starts_before: str(params.before),
  }
}
