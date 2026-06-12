import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { queryClient } from '../../helpers/query-mock'

beforeEach(() => {
  vi.mocked(createClient).mockReset()
})

describe('getTeamsByTournament', () => {
  it('devolve [] quando a query falha', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: null, error: { message: 'x' } }]) as never
    )
    const { getTeamsByTournament } = await import('@/lib/queries/teams')
    expect(await getTeamsByTournament('t1')).toEqual([])
  })

  it('conta apenas os jogadores activos por equipa', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([
        {
          data: [
            {
              id: 'team-1',
              name: 'Equipa 1',
              players: [
                { id: 'p1', is_active: true },
                { id: 'p2', is_active: false },
                { id: 'p3', is_active: true },
              ],
            },
          ],
          error: null,
        },
      ]) as never
    )
    const { getTeamsByTournament } = await import('@/lib/queries/teams')
    const [team] = await getTeamsByTournament('t1')
    expect(team.player_count).toBe(2)
    expect(team).not.toHaveProperty('players')
  })
})

describe('getTeamById', () => {
  it('devolve null quando a equipa não existe', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: null }]) as never
    )
    const { getTeamById } = await import('@/lib/queries/teams')
    expect(await getTeamById('team-1')).toBeNull()
  })

  it('devolve a equipa com jogadores quando existe', async () => {
    const team = { id: 'team-1', name: 'Equipa 1', players: [{ id: 'p1' }] }
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: team }]) as never
    )
    const { getTeamById } = await import('@/lib/queries/teams')
    expect(await getTeamById('team-1')).toEqual(team)
  })
})

describe('getTeamStats', () => {
  it('devolve tudo a zero quando não há standings', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: null }]) as never
    )
    const { getTeamStats } = await import('@/lib/queries/teams')
    expect(await getTeamStats('team-1', 't1')).toEqual({
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goals_for: 0,
      goals_against: 0,
    })
  })

  it('soma as standings de todos os grupos da equipa', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([
        {
          data: [
            {
              played: 3,
              won: 2,
              drawn: 1,
              lost: 0,
              goals_for: 7,
              goals_against: 2,
            },
            {
              played: 2,
              won: 0,
              drawn: 1,
              lost: 1,
              goals_for: 1,
              goals_against: 4,
            },
          ],
        },
      ]) as never
    )
    const { getTeamStats } = await import('@/lib/queries/teams')
    expect(await getTeamStats('team-1', 't1')).toEqual({
      played: 5,
      won: 2,
      drawn: 2,
      lost: 1,
      goals_for: 8,
      goals_against: 6,
    })
  })
})
