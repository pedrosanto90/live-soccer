import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'

type QueryResult = { data?: unknown; count?: number; error?: unknown }

// Builder "thenable": o cliente Supabase real é encadeável e, ao mesmo tempo,
// aguardável (PromiseLike). getTournamentStats aguarda o builder directamente
// no terminal .eq()/.in() para ler `count`, por isso o mock precisa de `then`.
// Cada chamada a from() consome o próximo resultado da fila (ordem determinística).
function queryClient(results: QueryResult[]) {
  let i = 0
  const make = () => {
    const result = results[i++] ?? { data: null, count: 0, error: null }
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order', 'limit', 'ilike', 'gte', 'lte']) {
      b[m] = vi.fn(() => b)
    }
    b.maybeSingle = vi.fn().mockResolvedValue(result)
    b.single = vi.fn().mockResolvedValue(result)
    b.then = (resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject)
    return b
  }
  return { from: vi.fn(make) }
}

beforeEach(() => {
  // Reset total: getTournamentsByUser chama createClient() de novo dentro de
  // getTournamentStats, por isso usamos mockResolvedValue (persistente no teste)
  // a devolver o MESMO client — a fila de from() é partilhada entre chamadas.
  vi.mocked(createClient).mockReset()
})

describe('getTournamentById', () => {
  it('devolve null quando o torneio não existe', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: null, error: null }]) as never
    )
    const { getTournamentById } = await import('@/lib/queries/tournaments')
    expect(await getTournamentById('inexistente')).toBeNull()
  })

  it('devolve o torneio quando existe', async () => {
    const tournament = { id: 't1', name: 'Torneio' }
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: tournament, error: null }]) as never
    )
    const { getTournamentById } = await import('@/lib/queries/tournaments')
    expect(await getTournamentById('t1')).toEqual(tournament)
  })
})

describe('getTournamentBySlug', () => {
  it('devolve null quando o slug não existe', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: null, error: null }]) as never
    )
    const { getTournamentBySlug } = await import('@/lib/queries/tournaments')
    expect(await getTournamentBySlug('inexistente')).toBeNull()
  })

  it('devolve o torneio (com relações) quando o slug existe', async () => {
    const tournament = { id: 't1', slug: 'torneio', tournament_phases: [] }
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: tournament, error: null }]) as never
    )
    const { getTournamentBySlug } = await import('@/lib/queries/tournaments')
    expect(await getTournamentBySlug('torneio')).toEqual(tournament)
  })
})

describe('getTournamentStats', () => {
  it('agrega as contagens de equipas e jogos', async () => {
    // Ordem das queries em Promise.all: teams, matches, active, finished.
    vi.mocked(createClient).mockResolvedValue(
      queryClient([
        { count: 4 },
        { count: 6 },
        { count: 1 },
        { count: 2 },
      ]) as never
    )
    const { getTournamentStats } = await import('@/lib/queries/tournaments')
    expect(await getTournamentStats('t1')).toEqual({
      teams: 4,
      matches: 6,
      active_matches: 1,
      finished_matches: 2,
    })
  })

  it('trata contagens nulas como 0', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{}, {}, {}, {}]) as never
    )
    const { getTournamentStats } = await import('@/lib/queries/tournaments')
    expect(await getTournamentStats('t1')).toEqual({
      teams: 0,
      matches: 0,
      active_matches: 0,
      finished_matches: 0,
    })
  })
})

describe('getPublicTournaments', () => {
  it('devolve [] quando a query falha', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: null, error: { message: 'boom' } }]) as never
    )
    const { getPublicTournaments } = await import('@/lib/queries/tournaments')
    expect(await getPublicTournaments()).toEqual([])
  })

  it('agrega contagens e detecta jogos ao vivo', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([
        {
          data: [
            {
              id: 't1',
              name: 'Torneio',
              status: 'active',
              teams: [{ count: 5 }],
              matches: [{ status: 'in_progress' }, { status: 'finished' }],
            },
          ],
          error: null,
        },
      ]) as never
    )
    const { getPublicTournaments } = await import('@/lib/queries/tournaments')
    const result = await getPublicTournaments()

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 't1',
      teams_count: 5,
      matches_count: 2,
      has_live_match: true,
    })
    // os campos embebidos não devem fazer parte do resultado final
    expect(result[0]).not.toHaveProperty('teams')
    expect(result[0]).not.toHaveProperty('matches')
  })

  it('ordena os torneios activos primeiro', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([
        {
          data: [
            { id: 'a', status: 'finished', teams: [], matches: [] },
            { id: 'b', status: 'active', teams: [], matches: [] },
            { id: 'c', status: 'draft', teams: [], matches: [] },
          ],
          error: null,
        },
      ]) as never
    )
    const { getPublicTournaments } = await import('@/lib/queries/tournaments')
    const result = await getPublicTournaments()
    expect(result.map((t) => t.id)).toEqual(['b', 'a', 'c'])
  })

  it('trata contagens e embeds nulos como 0/false', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([
        {
          data: [{ id: 't1', status: 'draft', teams: null, matches: null }],
          error: null,
        },
      ]) as never
    )
    const { getPublicTournaments } = await import('@/lib/queries/tournaments')
    const result = await getPublicTournaments()
    expect(result[0]).toMatchObject({
      teams_count: 0,
      matches_count: 0,
      has_live_match: false,
    })
  })
})

describe('getTournamentsByUser', () => {
  it('devolve [] quando a query falha', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: null, error: { message: 'boom' } }]) as never
    )
    const { getTournamentsByUser } = await import('@/lib/queries/tournaments')
    expect(await getTournamentsByUser('user-1')).toEqual([])
  })

  it('devolve [] quando não há torneios', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: [], error: null }]) as never
    )
    const { getTournamentsByUser } = await import('@/lib/queries/tournaments')
    expect(await getTournamentsByUser('user-1')).toEqual([])
  })

  it('anexa as estatísticas a cada torneio', async () => {
    // 1ª query: lista de torneios; as 4 seguintes: stats do torneio t1.
    vi.mocked(createClient).mockResolvedValue(
      queryClient([
        { data: [{ id: 't1', name: 'Torneio' }], error: null },
        { count: 4 },
        { count: 6 },
        { count: 1 },
        { count: 2 },
      ]) as never
    )
    const { getTournamentsByUser } = await import('@/lib/queries/tournaments')
    const result = await getTournamentsByUser('user-1')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 't1',
      name: 'Torneio',
      stats: { teams: 4, matches: 6, active_matches: 1, finished_matches: 2 },
    })
  })
})
