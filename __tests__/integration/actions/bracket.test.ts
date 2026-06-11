import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createClient } from '@/lib/supabase/server'
import { getQualifiedTeams } from '@/lib/queries/bracket'
import type { QualifiedTeam } from '@/lib/bracket'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
// As queries do bracket tocam a BD; mockamo-las e exercitamos só as actions.
vi.mock('@/lib/queries/bracket', () => ({
  getQualifiedTeams: vi.fn(),
  getBracketByPhase: vi.fn().mockResolvedValue([]),
}))

const mockUser = { id: 'user-1' }

// Mock encadeável: `maybeSingle` consome uma fila; awaits directos (count,
// insert, update().eq()) puxam da fila da tabela. As chamadas a `update` são
// registadas para inspecção.
function makeMock(opts: {
  maybeSingle?: Array<{ data: unknown; error?: unknown }>
  table?: Record<string, Array<{ data?: unknown; error?: unknown; count?: number }>>
}) {
  const maybeSingleQueue = [...(opts.maybeSingle ?? [])]
  const table = structuredClone(opts.table ?? {})
  const updates: Array<{ table: string; patch: Record<string, unknown> }> = []
  const inserts: Array<{ table: string; rows: unknown }> = []

  function build(name: string) {
    const next = () => builder
    const pull = () => (table[name] ?? []).shift() ?? { data: null, error: null }
    const builder: Record<string, unknown> = {
      select: next,
      insert: (rows: unknown) => {
        inserts.push({ table: name, rows })
        return builder
      },
      update: (patch: Record<string, unknown>) => {
        updates.push({ table: name, patch })
        return builder
      },
      delete: next,
      upsert: next,
      eq: next,
      neq: next,
      in: next,
      not: next,
      or: next,
      order: next,
      limit: next,
      maybeSingle: () =>
        Promise.resolve(maybeSingleQueue.shift() ?? { data: null, error: null }),
      single: () => Promise.resolve(pull()),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(pull()).then(resolve, reject),
    }
    return builder
  }

  return {
    client: {
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      from: vi.fn((name: string) => build(name)),
    },
    updates,
    inserts,
  }
}

const makeTeam = (pos: number, group: string): QualifiedTeam => ({
  team_id: `${group}-${pos}`,
  team_name: `Equipa ${group}${pos}`,
  team_short_name: null,
  color_primary: '#000',
  color_secondary: '#fff',
  from_group: group,
  position: pos,
})

const fourTeams = [
  makeTeam(1, 'A'),
  makeTeam(2, 'A'),
  makeTeam(1, 'B'),
  makeTeam(2, 'B'),
]

beforeEach(() => vi.clearAllMocks())

describe('generateKnockoutBracket', () => {
  it('erro se a fase não é de eliminatórias', async () => {
    const mock = makeMock({
      maybeSingle: [{ data: { id: 'p1', tournament_id: 't1', type: 'group' } }],
    })
    vi.mocked(createClient).mockResolvedValueOnce(mock.client as never)

    const { generateKnockoutBracket } = await import('@/lib/actions/bracket')
    const res = await generateKnockoutBracket('p1')
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/eliminatórias/i)
  })

  it('erro se já existem jogos na fase', async () => {
    const mock = makeMock({
      maybeSingle: [
        { data: { id: 'p1', tournament_id: 't1', type: 'knockout' } },
        { data: { role: 'admin' } },
      ],
      table: { matches: [{ count: 3 }] },
    })
    vi.mocked(createClient).mockResolvedValueOnce(mock.client as never)
    vi.mocked(getQualifiedTeams).mockResolvedValue(fourTeams)

    const { generateKnockoutBracket } = await import('@/lib/actions/bracket')
    const res = await generateKnockoutBracket('p1')
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/já foi gerado/i)
  })

  it('gera 3 jogos para 4 equipas (2 meias + 1 final)', async () => {
    const mock = makeMock({
      maybeSingle: [
        { data: { id: 'p1', tournament_id: 't1', type: 'knockout' } },
        { data: { role: 'admin' } },
      ],
      table: { matches: [{ count: 0 }, { error: null }] },
    })
    vi.mocked(createClient).mockResolvedValueOnce(mock.client as never)
    vi.mocked(getQualifiedTeams).mockResolvedValue(fourTeams)

    const { generateKnockoutBracket } = await import('@/lib/actions/bracket')
    const res = await generateKnockoutBracket('p1')
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.matches_created).toBe(3)

    // Um único insert com 3 jogos, todos da fase e sem grupo.
    expect(mock.inserts).toHaveLength(1)
    const rows = mock.inserts[0].rows as Array<Record<string, unknown>>
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.phase_id === 'p1' && r.group_id === null)).toBe(true)
    // A final (round 1) não aponta para nenhum jogo seguinte.
    const final = rows.find((r) => r.bracket_round === 1)
    expect(final?.next_match_id).toBeNull()
  })

  it('erro de permissão se não for admin', async () => {
    const mock = makeMock({
      maybeSingle: [
        { data: { id: 'p1', tournament_id: 't1', type: 'knockout' } },
        { data: { role: 'operator' } },
      ],
    })
    vi.mocked(createClient).mockResolvedValueOnce(mock.client as never)

    const { generateKnockoutBracket } = await import('@/lib/actions/bracket')
    const res = await generateKnockoutBracket('p1')
    expect(res.success).toBe(false)
  })
})

describe('advanceWinner', () => {
  it('coloca o vencedor no slot correcto do jogo seguinte', async () => {
    const finishedMatch = {
      tournament_id: 't1',
      status: 'finished',
      home_team_id: 'home',
      away_team_id: 'away',
      home_score: 3,
      away_score: 1,
      home_score_extra: 0,
      away_score_extra: 0,
      home_penalties: 0,
      away_penalties: 0,
      next_match_id: 'final',
      next_match_slot: 'away',
    }
    const mock = makeMock({
      maybeSingle: [{ data: finishedMatch }, { data: { role: 'admin' } }],
      table: { matches: [{ error: null }] },
    })
    vi.mocked(createClient).mockResolvedValueOnce(mock.client as never)

    const { advanceWinner } = await import('@/lib/actions/bracket')
    const res = await advanceWinner('semi-1')
    expect(res.success).toBe(true)

    expect(mock.updates).toHaveLength(1)
    expect(mock.updates[0].patch).toEqual({ away_team_id: 'home' })
  })

  it('não faz nada na final (sem jogo seguinte)', async () => {
    const finalMatch = {
      tournament_id: 't1',
      status: 'finished',
      home_team_id: 'home',
      away_team_id: 'away',
      home_score: 2,
      away_score: 0,
      home_score_extra: 0,
      away_score_extra: 0,
      home_penalties: 0,
      away_penalties: 0,
      next_match_id: null,
      next_match_slot: null,
    }
    const mock = makeMock({
      maybeSingle: [{ data: finalMatch }, { data: { role: 'admin' } }],
    })
    vi.mocked(createClient).mockResolvedValueOnce(mock.client as never)

    const { advanceWinner } = await import('@/lib/actions/bracket')
    const res = await advanceWinner('final')
    expect(res.success).toBe(true)
    expect(mock.updates).toHaveLength(0)
  })
})
