import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { makeSupabaseMock } from '../../helpers/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockUser = { id: 'user-123' }

// IDs válidos (uuid) para passar pelo schema.
const PHASE = '11111111-1111-4111-8111-111111111111'
const HOME = '22222222-2222-4222-8222-222222222222'
const AWAY = '33333333-3333-4333-8333-333333333333'
const MATCH = '44444444-4444-4444-8444-444444444444'

// Mock "thenable" por tabela (à semelhança do usado nos testes do sorteio):
// suporta awaits encadeados de contagens (head:true) e terminais single/
// maybeSingle a partir de filas.
function makeMatchMock(opts: {
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
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: mockUser }, error: null }),
    },
    from: vi.fn((table: string) => build(table)),
  }
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    phase_id: PHASE,
    home_team_id: HOME,
    away_team_id: AWAY,
    ...overrides,
  }
}

describe('createMatch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita quando as equipas são iguais', async () => {
    const { createMatch } = await import('@/lib/actions/matches')
    const result = await createMatch('t-1', baseInput({ away_team_id: HOME }))
    expect(result).toEqual({
      success: false,
      error: 'As equipas não podem ser iguais',
    })
  })

  it('cria o jogo com sucesso', async () => {
    const mock = makeMatchMock({
      maybeSingleQueue: [
        { data: { role: 'admin' } }, // memberRole
        { data: { id: PHASE } }, // fase pertence ao torneio
      ],
      tableResults: {
        teams: [{ count: 2, error: null }], // ambas as equipas no torneio
        matches: [{ data: { id: MATCH, status: 'scheduled' }, error: null }], // insert
      },
    })
    vi.mocked(createClient).mockResolvedValueOnce(mock as never)

    const { createMatch } = await import('@/lib/actions/matches')
    const result = await createMatch('t-1', baseInput())

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.id).toBe(MATCH)
  })

  it('rejeita quando uma equipa não pertence ao torneio', async () => {
    const mock = makeMatchMock({
      maybeSingleQueue: [{ data: { role: 'admin' } }, { data: { id: PHASE } }],
      tableResults: {
        teams: [{ count: 1, error: null }], // só uma equipa encontrada
      },
    })
    vi.mocked(createClient).mockResolvedValueOnce(mock as never)

    const { createMatch } = await import('@/lib/actions/matches')
    const result = await createMatch('t-1', baseInput())
    expect(result).toEqual({
      success: false,
      error: 'As equipas têm de pertencer ao torneio.',
    })
  })
})

describe('updateMatch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita editar um jogo que já foi iniciado', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        user: mockUser,
        maybeSingle: {
          data: { id: MATCH, tournament_id: 't-1', status: 'in_progress' },
        },
      }) as never
    )

    const { updateMatch } = await import('@/lib/actions/matches')
    const result = await updateMatch(MATCH, baseInput())
    expect(result).toEqual({
      success: false,
      error: 'Não é possível editar um jogo que já foi iniciado.',
    })
  })
})

describe('scheduleMatch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('agenda um jogo com sucesso', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        user: mockUser,
        maybeSingleSeq: [
          { data: { id: MATCH, tournament_id: 't-1', status: 'scheduled' } }, // getMatchRow
          { data: { role: 'admin' } }, // memberRole
        ],
        single: { data: { id: MATCH, scheduled_at: '2025-06-14T15:30' } }, // update
      }) as never
    )

    const { scheduleMatch } = await import('@/lib/actions/matches')
    const result = await scheduleMatch(MATCH, {
      scheduled_at: '2025-06-14T15:30',
      venue: 'Pavilhão',
      referee_id: null,
    })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.id).toBe(MATCH)
  })

  it('rejeita agendar um jogo já terminado', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        user: mockUser,
        maybeSingle: {
          data: { id: MATCH, tournament_id: 't-1', status: 'finished' },
        },
      }) as never
    )

    const { scheduleMatch } = await import('@/lib/actions/matches')
    const result = await scheduleMatch(MATCH, { scheduled_at: '2025-06-14T15:30' })
    expect(result.success).toBe(false)
  })
})
