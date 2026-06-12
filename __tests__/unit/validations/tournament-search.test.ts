import { describe, it, expect } from 'vitest'

import { parseTournamentFilters } from '@/lib/validations/tournament-search'

describe('parseTournamentFilters', () => {
  it('retorna filtros vazios para searchParams vazio', () => {
    const filters = parseTournamentFilters({})
    expect(filters.search).toBeUndefined()
    expect(filters.status).toBeUndefined()
    expect(filters.starts_after).toBeUndefined()
    expect(filters.starts_before).toBeUndefined()
  })

  it('parse correcto de todos os filtros', () => {
    const filters = parseTournamentFilters({
      search: 'verão',
      status: 'active',
      after: '2025-01-01',
      before: '2025-12-31',
    })
    expect(filters.search).toBe('verão')
    expect(filters.status).toBe('active')
    expect(filters.starts_after).toBe('2025-01-01')
    expect(filters.starts_before).toBe('2025-12-31')
  })

  it('ignora status inválido', () => {
    const filters = parseTournamentFilters({ status: 'invalido' })
    expect(filters.status).toBeUndefined()
  })

  it('ignora strings vazias ou só com espaços', () => {
    const filters = parseTournamentFilters({ search: '   ', status: '' })
    expect(filters.search).toBeUndefined()
    expect(filters.status).toBeUndefined()
  })

  it('usa o primeiro valor quando o searchParam é um array', () => {
    const filters = parseTournamentFilters({ search: ['primeiro', 'segundo'] })
    expect(filters.search).toBe('primeiro')
  })
})
