import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { makeSupabaseMock } from '../../helpers/supabase-mock'

const mockUser = { id: 'user-123', email: 'joao@example.com' }

const validInput = {
  name: 'Torneio Teste',
  visibility: 'public' as const,
  match: {
    half_duration_minutes: 20,
    half_time_duration_minutes: 5,
    extra_time_duration_minutes: 5,
    max_fouls_per_team_per_half: 5,
    penalty_shootout_kicks: 5,
  },
  scoring: { points_win: 3, points_draw: 1, points_loss: 0 },
  cards: { yellow_cards_for_suspension: 3, red_card_suspension_matches: 1 },
  tiebreak_order: ['points', 'goal_difference', 'draw'] as const,
}

describe('createTournament action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna erro se o utilizador não está autenticado', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({ user: null }) as never
    )

    const { createTournament } = await import('@/lib/actions/tournaments')
    const result = await createTournament(validInput as never)

    expect(result).toEqual({
      success: false,
      error: 'Sessão expirada. Inicia sessão novamente.',
    })
  })

  it('cria torneio com sucesso e redireciona para o overview', async () => {
    // uniqueSlug usa maybeSingle (slug livre → data null); o insert usa
    // select().single() → devolve o id criado.
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        user: mockUser,
        maybeSingle: { data: null },
        single: { data: { id: 'tournament-123' }, error: null },
      }) as never
    )
    const { redirect } = await import('next/navigation')

    const { createTournament } = await import('@/lib/actions/tournaments')
    await createTournament(validInput as never)

    expect(redirect).toHaveBeenCalledWith('/tournaments/tournament-123')
  })

  it('retorna erro se a inserção falha', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        user: mockUser,
        maybeSingle: { data: null },
        single: { data: null, error: { message: 'DB error' } },
      }) as never
    )

    const { createTournament } = await import('@/lib/actions/tournaments')
    const result = await createTournament(validInput as never)

    expect(result).toEqual({
      success: false,
      error: 'Não foi possível criar o torneio. Tenta novamente.',
    })
  })

  it('rejeita input inválido sem tocar na base de dados', async () => {
    const { createTournament } = await import('@/lib/actions/tournaments')
    const result = await createTournament({ ...validInput, name: 'AB' } as never)
    expect(result.success).toBe(false)
  })
})

describe('updateTournament action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna erro se o utilizador não está autenticado', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({ user: null }) as never
    )

    const { updateTournament } = await import('@/lib/actions/tournaments')
    const result = await updateTournament('t1', validInput as never)

    expect(result).toEqual({
      success: false,
      error: 'Sessão expirada. Inicia sessão novamente.',
    })
  })

  it('rejeita quando o utilizador não é admin do torneio', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        user: mockUser,
        maybeSingle: { data: { role: 'viewer' } },
      }) as never
    )

    const { updateTournament } = await import('@/lib/actions/tournaments')
    const result = await updateTournament('t1', validInput as never)

    expect(result).toEqual({
      success: false,
      error: 'Não tens permissão para editar este torneio.',
    })
  })

  it('atualiza e devolve o torneio quando o utilizador é admin', async () => {
    const updated = { id: 't1', name: 'Torneio Teste' }
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        user: mockUser,
        maybeSingle: { data: { role: 'admin' } }, // membership
        single: { data: updated, error: null }, // update().select().single()
      }) as never
    )

    const { updateTournament } = await import('@/lib/actions/tournaments')
    const result = await updateTournament('t1', validInput as never)

    expect(result).toEqual({ success: true, data: updated })
  })

  it('retorna erro se a atualização falha', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        user: mockUser,
        maybeSingle: { data: { role: 'admin' } },
        single: { data: null, error: { message: 'boom' } },
      }) as never
    )

    const { updateTournament } = await import('@/lib/actions/tournaments')
    const result = await updateTournament('t1', validInput as never)

    expect(result).toEqual({
      success: false,
      error: 'Não foi possível guardar as alterações.',
    })
  })
})

describe('updateTournamentStatus action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejeita quando o utilizador não é admin', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        user: mockUser,
        maybeSingle: { data: { role: 'viewer' } },
      }) as never
    )

    const { updateTournamentStatus } = await import('@/lib/actions/tournaments')
    const result = await updateTournamentStatus('t1', 'active')

    expect(result).toEqual({
      success: false,
      error: 'Não tens permissão para gerir este torneio.',
    })
  })

  it('retorna erro quando o torneio não existe', async () => {
    // 1ª maybeSingle → membership admin; 2ª maybeSingle → torneio inexistente.
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        user: mockUser,
        maybeSingleSeq: [{ data: { role: 'admin' } }, { data: null }],
      }) as never
    )

    const { updateTournamentStatus } = await import('@/lib/actions/tournaments')
    const result = await updateTournamentStatus('t1', 'active')

    expect(result).toEqual({ success: false, error: 'Torneio não encontrado.' })
  })

  it('rejeita uma transição de estado não permitida', async () => {
    // draft → finished não é permitido (só draft → active|cancelled).
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        user: mockUser,
        maybeSingleSeq: [{ data: { role: 'admin' } }, { data: { status: 'draft' } }],
      }) as never
    )

    const { updateTournamentStatus } = await import('@/lib/actions/tournaments')
    const result = await updateTournamentStatus('t1', 'finished')

    expect(result).toEqual({
      success: false,
      error: 'Transição de estado não permitida.',
    })
  })

  it('aplica uma transição válida (draft → active)', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        user: mockUser,
        maybeSingleSeq: [{ data: { role: 'admin' } }, { data: { status: 'draft' } }],
      }) as never
    )

    const { updateTournamentStatus } = await import('@/lib/actions/tournaments')
    const result = await updateTournamentStatus('t1', 'active')

    expect(result).toEqual({ success: true, data: undefined })
  })
})
