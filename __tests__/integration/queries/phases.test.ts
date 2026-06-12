import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { queryClient } from '../../helpers/query-mock'

beforeEach(() => {
  vi.mocked(createClient).mockReset()
})

// Linha crua de fase tal como o Supabase a devolve (grupos + group_teams + jogos).
function rawPhase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    tournament_id: 't1',
    name: 'Fase de grupos',
    type: 'group',
    order_index: 0,
    created_at: '2025-01-01',
    groups: [
      {
        id: 'g2',
        phase_id: 'p1',
        name: 'B',
        order_index: 1,
        group_teams: [{ teams: { id: 'team-2', name: 'Equipa 2' } }],
      },
      {
        id: 'g1',
        phase_id: 'p1',
        name: 'A',
        order_index: 0,
        group_teams: [
          { teams: { id: 'team-1', name: 'Equipa 1' } },
          { teams: null },
        ],
      },
    ],
    matches: [{ id: 'm1', status: 'scheduled' }],
    ...overrides,
  }
}

describe('getPhasesByTournament', () => {
  it('devolve [] quando a query falha', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: null, error: { message: 'x' } }]) as never
    )
    const { getPhasesByTournament } = await import('@/lib/queries/phases')
    expect(await getPhasesByTournament('t1')).toEqual([])
  })

  it('mapeia fases: ordena grupos, ignora teams null e conta jogos', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: [rawPhase()], error: null }]) as never
    )
    const { getPhasesByTournament } = await import('@/lib/queries/phases')
    const [phase] = await getPhasesByTournament('t1')

    // grupos ordenados por order_index (A antes de B)
    expect(phase.groups.map((g) => g.name)).toEqual(['A', 'B'])
    // teams null filtradas no grupo A
    expect(phase.groups[0].teams).toHaveLength(1)
    expect(phase.matches_count).toBe(1)
    // todos os jogos 'scheduled' → pode fazer reset
    expect(phase.can_reset).toBe(true)
  })

  it('can_reset é falso quando algum jogo saiu de scheduled', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([
        {
          data: [rawPhase({ matches: [{ id: 'm1', status: 'finished' }] })],
          error: null,
        },
      ]) as never
    )
    const { getPhasesByTournament } = await import('@/lib/queries/phases')
    const [phase] = await getPhasesByTournament('t1')
    expect(phase.can_reset).toBe(false)
  })
})

describe('getPhaseById', () => {
  it('devolve null quando a fase não existe', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: null }]) as never
    )
    const { getPhaseById } = await import('@/lib/queries/phases')
    expect(await getPhaseById('p1')).toBeNull()
  })

  it('mapeia a fase quando existe', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: rawPhase() }]) as never
    )
    const { getPhaseById } = await import('@/lib/queries/phases')
    const phase = await getPhaseById('p1')
    expect(phase?.id).toBe('p1')
    expect(phase?.groups).toHaveLength(2)
  })
})

describe('getDrawStatus', () => {
  it('devolve não-sorteado quando não há grupos', async () => {
    // 1ª query: groups (vazio) → não chega a contar group_teams.
    // 2ª query (matches): vazio.
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: [] }, { data: [] }]) as never
    )
    const { getDrawStatus } = await import('@/lib/queries/phases')
    expect(await getDrawStatus('p1')).toEqual({
      drawn: false,
      can_reset: true,
      groups_count: 0,
      teams_count: 0,
    })
  })

  it('devolve sorteado com contagens quando há grupos e equipas', async () => {
    // Ordem: groups, group_teams(count), matches.
    vi.mocked(createClient).mockResolvedValue(
      queryClient([
        { data: [{ id: 'g1' }, { id: 'g2' }] },
        { count: 8 },
        { data: [{ status: 'scheduled' }, { status: 'in_progress' }] },
      ]) as never
    )
    const { getDrawStatus } = await import('@/lib/queries/phases')
    expect(await getDrawStatus('p1')).toEqual({
      drawn: true,
      can_reset: false,
      groups_count: 2,
      teams_count: 8,
    })
  })
})
