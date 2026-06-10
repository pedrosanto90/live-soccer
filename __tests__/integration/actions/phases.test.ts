import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { makeSupabaseMock } from '../../helpers/supabase-mock'

const mockUser = { id: 'user-123' }

// ---------------------------------------------------------------------------
// Mock dedicado ao caminho feliz de runDraw. O builder partilhado não suporta
// awaits encadeados que não passam por single()/maybeSingle() (ex.: insert sem
// single, select+order, contagens), por isso construímos um cliente "thenable"
// com filas de resultados por tabela.
// ---------------------------------------------------------------------------
function makeDrawMock(opts: {
  tableResults: Record<string, Array<Record<string, unknown>>>
  maybeSingleQueue: Array<{ data: unknown; error?: unknown }>
}) {
  const tableResults = structuredClone(opts.tableResults)
  const maybeSingleQueue = [...opts.maybeSingleQueue]

  function build(table: string) {
    const next = () => builder
    const builder: Record<string, unknown> = {
      select: next,
      insert: next,
      update: next,
      delete: next,
      eq: next,
      neq: next,
      in: next,
      or: next,
      order: next,
      limit: next,
      maybeSingle: () =>
        Promise.resolve(maybeSingleQueue.shift() ?? { data: null, error: null }),
      single: () =>
        Promise.resolve(
          (tableResults[table] ?? []).shift() ?? { data: null, error: null }
        ),
      // Torna o builder "aguardável": resolve o próximo resultado da tabela.
      then: (
        resolve: (v: unknown) => unknown,
        reject?: (e: unknown) => unknown
      ) => {
        const res = (tableResults[table] ?? []).shift() ?? {
          data: null,
          error: null,
        }
        return Promise.resolve(res).then(resolve, reject)
      },
    }
    return builder
  }

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    },
    from: vi.fn((table: string) => build(table)),
  }
}

describe('createPhase action', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita utilizador não autenticado', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({ user: null }) as never
    )
    const { createPhase } = await import('@/lib/actions/phases')
    const result = await createPhase('t-1', { name: 'Fase de Grupos', type: 'group' })
    expect(result).toEqual({
      success: false,
      error: 'Sessão expirada. Inicia sessão novamente.',
    })
  })

  it('rejeita quando o utilizador não é admin', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({ user: mockUser, maybeSingle: { data: { role: 'operator' } } }) as never
    )
    const { createPhase } = await import('@/lib/actions/phases')
    const result = await createPhase('t-1', { name: 'Fase de Grupos', type: 'group' })
    expect(result.success).toBe(false)
  })

  it('cria a fase quando o utilizador é admin', async () => {
    const created = { id: 'p-1', tournament_id: 't-1', name: 'Fase de Grupos', type: 'group', order_index: 0 }
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        user: mockUser,
        maybeSingle: { data: { role: 'admin' } },
        single: { data: created, error: null },
      }) as never
    )
    const { createPhase } = await import('@/lib/actions/phases')
    const result = await createPhase('t-1', { name: 'Fase de Grupos', type: 'group' })
    expect(result).toEqual({ success: true, data: created })
  })

  it('rejeita input inválido sem tocar na base de dados', async () => {
    const { createPhase } = await import('@/lib/actions/phases')
    const result = await createPhase('t-1', { name: 'A', type: 'group' })
    expect(result.success).toBe(false)
  })
})

describe('runDraw action — guardas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita quando o utilizador não é admin', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        user: mockUser,
        // tournamentIdOfPhase, depois memberRole (viewer)
        maybeSingleSeq: [
          { data: { tournament_id: 't-1' } },
          { data: { role: 'viewer' } },
        ],
      }) as never
    )
    const { runDraw } = await import('@/lib/actions/phases')
    const result = await runDraw('p-1', {
      mode: 'random',
      num_groups: 2,
      teams_per_group: 3,
    })
    expect(result.success).toBe(false)
  })

  it('rejeita fases que não são de grupos', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        user: mockUser,
        maybeSingleSeq: [
          { data: { tournament_id: 't-1' } },
          { data: { role: 'admin' } },
          { data: { type: 'knockout' } },
        ],
      }) as never
    )
    const { runDraw } = await import('@/lib/actions/phases')
    const result = await runDraw('p-1', {
      mode: 'random',
      num_groups: 2,
      teams_per_group: 3,
    })
    expect(result).toEqual({
      success: false,
      error: 'O sorteio só se aplica a fases de grupos.',
    })
  })
})

describe('runDraw action — caminho feliz', () => {
  beforeEach(() => vi.clearAllMocks())

  const sixTeams = Array.from({ length: 6 }, (_, i) => ({
    id: `team-${i + 1}`,
    name: `Equipa ${i + 1}`,
  }))

  it('cria grupos, distribui equipas e gera os jogos (round-robin)', async () => {
    const mock = makeDrawMock({
      maybeSingleQueue: [
        { data: { tournament_id: 't-1' } }, // tournamentIdOfPhase
        { data: { role: 'admin' } }, // memberRole
        { data: { type: 'group' } }, // phase.type
      ],
      tableResults: {
        groups: [
          { count: 0, error: null }, // sorteio ainda não feito
          { data: [{ id: 'g-1' }, { id: 'g-2' }], error: null }, // insert grupos
        ],
        teams: [{ data: sixTeams, error: null }], // equipas do torneio
        group_teams: [{ error: null }], // insert group_teams
        matches: [{ error: null }], // insert jogos
      },
    })
    vi.mocked(createClient).mockResolvedValueOnce(mock as never)

    const { runDraw } = await import('@/lib/actions/phases')
    const result = await runDraw('p-1', {
      mode: 'random',
      num_groups: 2,
      teams_per_group: 3,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.groups).toHaveLength(2)
      // 2 grupos × 3 equipas → 3 jogos por grupo = 6 jogos.
      expect(result.data.matches_created).toBe(6)
    }
  })

  it('rejeita quando o nº de equipas não corresponde à configuração', async () => {
    const mock = makeDrawMock({
      maybeSingleQueue: [
        { data: { tournament_id: 't-1' } },
        { data: { role: 'admin' } },
        { data: { type: 'group' } },
      ],
      tableResults: {
        groups: [{ count: 0, error: null }],
        teams: [{ data: sixTeams, error: null }], // 6 equipas
      },
    })
    vi.mocked(createClient).mockResolvedValueOnce(mock as never)

    const { runDraw } = await import('@/lib/actions/phases')
    // 2 × 4 = 8 lugares, mas só há 6 equipas.
    const result = await runDraw('p-1', {
      mode: 'random',
      num_groups: 2,
      teams_per_group: 4,
    })
    expect(result.success).toBe(false)
  })
})
