import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { makeSupabaseMock } from '../../helpers/supabase-mock'

const mockUser = { id: 'user-123' }
const mockTeam = {
  id: 'team-123',
  tournament_id: 'tournament-123',
  name: 'Sporting CP',
  short_name: 'SCP',
  color_primary: '#006600',
  color_secondary: '#ffffff',
}

const validTeam = {
  name: 'Sporting CP',
  short_name: 'SCP',
  color_primary: '#006600',
  color_secondary: '#ffffff',
} as const

describe('createTeam action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna erro se o utilizador não está autenticado', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({ user: null }) as never
    )

    const { createTeam } = await import('@/lib/actions/teams')
    const result = await createTeam('tournament-123', validTeam)

    expect(result).toEqual({
      success: false,
      error: 'Sessão expirada. Inicia sessão novamente.',
    })
  })

  it('rejeita quando o utilizador não é membro do torneio', async () => {
    // memberRole → null (sem membership)
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({ user: mockUser, maybeSingle: { data: null } }) as never
    )

    const { createTeam } = await import('@/lib/actions/teams')
    const result = await createTeam('tournament-123', validTeam)

    expect(result.success).toBe(false)
  })

  it('rejeita quando já existe uma equipa com o mesmo nome', async () => {
    // 1ª maybeSingle → membership admin; 2ª maybeSingle → equipa existente.
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        user: mockUser,
        maybeSingleSeq: [{ data: { role: 'admin' } }, { data: { id: 'other' } }],
      }) as never
    )

    const { createTeam } = await import('@/lib/actions/teams')
    const result = await createTeam('tournament-123', validTeam)

    expect(result).toEqual({
      success: false,
      error: 'Já existe uma equipa com esse nome.',
    })
  })

  it('cria equipa com sucesso', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        user: mockUser,
        // membership admin, depois nome livre (null)
        maybeSingleSeq: [{ data: { role: 'admin' } }, { data: null }],
        single: { data: mockTeam, error: null },
      }) as never
    )

    const { createTeam } = await import('@/lib/actions/teams')
    const result = await createTeam('tournament-123', validTeam)

    expect(result).toEqual({ success: true, data: mockTeam })
  })

  it('rejeita input inválido sem tocar na base de dados', async () => {
    const { createTeam } = await import('@/lib/actions/teams')
    const result = await createTeam('tournament-123', { ...validTeam, name: 'A' })
    expect(result.success).toBe(false)
  })
})

describe('updateTeam action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('actualiza a equipa quando o utilizador tem acesso', async () => {
    const updated = { ...mockTeam, name: 'Benfica' }
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        user: mockUser,
        // tournamentIdOfTeam, membership, clash (null)
        maybeSingleSeq: [
          { data: { tournament_id: 'tournament-123' } },
          { data: { role: 'operator' } },
          { data: null },
        ],
        single: { data: updated, error: null },
      }) as never
    )

    const { updateTeam } = await import('@/lib/actions/teams')
    const result = await updateTeam('team-123', { ...validTeam, name: 'Benfica' })

    expect(result).toEqual({ success: true, data: updated })
  })
})

describe('deleteTeam action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejeita quando o utilizador não é admin', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        user: mockUser,
        maybeSingleSeq: [
          { data: { tournament_id: 'tournament-123' } },
          { data: { role: 'operator' } },
        ],
      }) as never
    )

    const { deleteTeam } = await import('@/lib/actions/teams')
    const result = await deleteTeam('team-123')

    expect(result).toEqual({
      success: false,
      error: 'Apenas um administrador pode apagar equipas.',
    })
  })

  it('apaga a equipa quando não tem jogos associados', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        user: mockUser,
        maybeSingleSeq: [
          { data: { tournament_id: 'tournament-123' } },
          { data: { role: 'admin' } },
        ],
      }) as never
    )

    const { deleteTeam } = await import('@/lib/actions/teams')
    const result = await deleteTeam('team-123')

    expect(result).toEqual({ success: true, data: undefined })
  })
})

describe('togglePlayerActive action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inverte o estado is_active do jogador', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        user: mockUser,
        // jogador (team_id + is_active), tournamentIdOfTeam, membership
        maybeSingleSeq: [
          { data: { team_id: 'team-123', is_active: true } },
          { data: { tournament_id: 'tournament-123' } },
          { data: { role: 'admin' } },
        ],
      }) as never
    )

    const { togglePlayerActive } = await import('@/lib/actions/teams')
    const result = await togglePlayerActive('player-123')

    expect(result).toEqual({ success: true, data: { is_active: false } })
  })
})
