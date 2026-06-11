import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createClient } from '@/lib/supabase/server'
import { updateStandings } from '@/lib/actions/standings'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/actions/standings', () => ({
  updateStandings: vi.fn().mockResolvedValue({ success: true, data: undefined }),
}))

const MATCH = 'match-1'
const mockUser = { id: 'user-1' }

// Mock encadeável por tabela: `maybeSingle`/`single` consomem filas; `then`
// (awaits directos de update().eq()) também devolve da fila da tabela.
function makeMock(opts: {
  maybeSingle?: Array<{ data: unknown; error?: unknown }>
  table?: Record<string, Array<{ data?: unknown; error?: unknown; count?: number }>>
}) {
  const maybeSingleQueue = [...(opts.maybeSingle ?? [])]
  const table = structuredClone(opts.table ?? {})

  function build(name: string) {
    const next = () => builder
    const pull = () =>
      (table[name] ?? []).shift() ?? { data: null, error: null }
    const builder: Record<string, unknown> = {
      select: next,
      insert: next,
      update: next,
      delete: next,
      upsert: next,
      eq: next,
      neq: next,
      in: next,
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
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: mockUser }, error: null }),
    },
    from: vi.fn((name: string) => build(name)),
  }
}

const scheduledMatch = {
  id: MATCH,
  tournament_id: 't-1',
  home_team_id: 'home',
  away_team_id: 'away',
  status: 'scheduled',
  current_period: null,
  home_score: 0,
  away_score: 0,
  home_fouls_h1: 0,
  away_fouls_h1: 0,
  timer_started_at: null,
  timer_elapsed_secs: 0,
}

beforeEach(() => vi.clearAllMocks())

describe('startMatch', () => {
  it('inicia um jogo agendado', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeMock({
        maybeSingle: [{ data: scheduledMatch }, { data: { role: 'admin' } }],
        table: {
          matches: [{ data: { ...scheduledMatch, status: 'in_progress' } }],
        },
      }) as never
    )

    const { startMatch } = await import('@/lib/actions/match-admin')
    const res = await startMatch(MATCH)
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.status).toBe('in_progress')
  })

  it('rejeita iniciar um jogo já em curso', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeMock({
        maybeSingle: [
          { data: { ...scheduledMatch, status: 'in_progress' } },
          { data: { role: 'admin' } },
        ],
      }) as never
    )

    const { startMatch } = await import('@/lib/actions/match-admin')
    const res = await startMatch(MATCH)
    expect(res).toEqual({ success: false, error: 'O jogo já foi iniciado.' })
  })

  it('rejeita quem não é staff', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeMock({
        maybeSingle: [{ data: scheduledMatch }, { data: null }],
      }) as never
    )

    const { startMatch } = await import('@/lib/actions/match-admin')
    const res = await startMatch(MATCH)
    expect(res.success).toBe(false)
  })
})

describe('pauseTimer / resumeTimer', () => {
  it('pausa guardando o tempo decorrido e limpa timer_started_at', async () => {
    const running = {
      ...scheduledMatch,
      status: 'in_progress',
      current_period: 'first_half',
      timer_elapsed_secs: 60,
      timer_started_at: new Date(Date.now() - 5000).toISOString(),
    }
    vi.mocked(createClient).mockResolvedValueOnce(
      makeMock({
        maybeSingle: [{ data: running }, { data: { role: 'admin' } }],
        table: {
          matches: [{ data: { ...running, timer_started_at: null } }],
        },
      }) as never
    )

    const { pauseTimer } = await import('@/lib/actions/match-admin')
    const res = await pauseTimer(MATCH)
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.timer_started_at).toBeNull()
  })
})

describe('addEvent', () => {
  it('regista um golo da equipa da casa', async () => {
    const inPlay = {
      ...scheduledMatch,
      status: 'in_progress',
      current_period: 'first_half',
    }
    vi.mocked(createClient).mockResolvedValueOnce(
      makeMock({
        maybeSingle: [{ data: inPlay }, { data: { role: 'admin' } }],
        table: {
          match_events: [{ data: { id: 'e1', event_type: 'goal' } }],
          matches: [{ data: null }], // update dos contadores
        },
      }) as never
    )

    const { addEvent } = await import('@/lib/actions/match-admin')
    const res = await addEvent(MATCH, {
      team_id: 'home',
      event_type: 'goal',
      elapsed_secs: 120,
    })
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.event.id).toBe('e1')
  })
})

describe('cancelEvent', () => {
  it('anula um evento e devolve sucesso', async () => {
    const event = {
      id: 'e1',
      match_id: MATCH,
      team_id: 'home',
      event_type: 'goal',
      period: 'first_half',
      is_cancelled: false,
    }
    const match = { ...scheduledMatch, home_score: 1 }
    vi.mocked(createClient).mockResolvedValueOnce(
      makeMock({
        maybeSingle: [{ data: event }, { data: match }, { data: { role: 'admin' } }],
        table: {
          match_events: [{ data: null }], // update is_cancelled
          matches: [{ data: null }], // decremento do score
        },
      }) as never
    )

    const { cancelEvent } = await import('@/lib/actions/match-admin')
    const res = await cancelEvent('e1')
    expect(res.success).toBe(true)
  })
})

describe('endHalf', () => {
  it('passa da 1.ª parte para intervalo', async () => {
    const running = {
      ...scheduledMatch,
      status: 'in_progress',
      current_period: 'first_half',
      timer_started_at: new Date().toISOString(),
    }
    vi.mocked(createClient).mockResolvedValueOnce(
      makeMock({
        maybeSingle: [{ data: running }, { data: { role: 'admin' } }],
        table: {
          matches: [{ data: { ...running, status: 'half_time' } }],
        },
      }) as never
    )

    const { endHalf } = await import('@/lib/actions/match-admin')
    const res = await endHalf(MATCH)
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.status).toBe('half_time')
  })
})

describe('finishMatch', () => {
  it('termina o jogo e actualiza a classificação', async () => {
    const running = {
      ...scheduledMatch,
      status: 'in_progress',
      current_period: 'second_half',
      home_score: 2,
      away_score: 1,
    }
    vi.mocked(createClient).mockResolvedValueOnce(
      makeMock({
        maybeSingle: [{ data: running }, { data: { role: 'admin' } }],
        table: {
          matches: [{ data: { ...running, status: 'finished' } }],
        },
      }) as never
    )

    const { finishMatch } = await import('@/lib/actions/match-admin')
    const res = await finishMatch(MATCH, 'finish')
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.status).toBe('finished')
    expect(updateStandings).toHaveBeenCalledWith(MATCH)
  })

  it('não actualiza a classificação no caminho dos penáltis', async () => {
    const running = {
      ...scheduledMatch,
      status: 'in_progress',
      current_period: 'second_half',
    }
    vi.mocked(createClient).mockResolvedValueOnce(
      makeMock({
        maybeSingle: [{ data: running }, { data: { role: 'admin' } }],
        table: {
          matches: [{ data: { ...running, status: 'penalties' } }],
        },
      }) as never
    )

    const { finishMatch } = await import('@/lib/actions/match-admin')
    const res = await finishMatch(MATCH, 'penalties')
    expect(res.success).toBe(true)
    expect(updateStandings).not.toHaveBeenCalled()
  })
})
