import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { queryClient } from '../../helpers/query-mock'

beforeEach(() => {
  vi.mocked(createClient).mockReset()
})

// Jogo de bracket cru tal como o Supabase o devolve.
function rawBracketMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    bracket_round: 2,
    bracket_position: 0,
    next_match_id: 'm-final',
    next_match_slot: 'home',
    home_team_id: 'team-1',
    away_team_id: 'team-2',
    status: 'finished',
    home_score: 3,
    away_score: 1,
    home_score_extra: 0,
    away_score_extra: 0,
    home_penalties: 0,
    away_penalties: 0,
    home_team: { id: 'team-1', name: 'Equipa 1' },
    away_team: { id: 'team-2', name: 'Equipa 2' },
    ...overrides,
  }
}

describe('getBracketByPhase', () => {
  it('devolve [] quando a query falha', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: null, error: { message: 'x' } }]) as never
    )
    const { getBracketByPhase } = await import('@/lib/queries/bracket')
    expect(await getBracketByPhase('p1')).toEqual([])
  })

  it('mapeia os jogos e calcula o vencedor de um jogo terminado', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: [rawBracketMatch()], error: null }]) as never
    )
    const { getBracketByPhase } = await import('@/lib/queries/bracket')
    const [match] = await getBracketByPhase('p1')
    expect(match.winner_team_id).toBe('team-1')
    expect(match.home_team?.id).toBe('team-1')
    expect(match.bracket_round).toBe(2)
  })

  it('não calcula vencedor quando o jogo ainda não terminou', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([
        { data: [rawBracketMatch({ status: 'scheduled' })], error: null },
      ]) as never
    )
    const { getBracketByPhase } = await import('@/lib/queries/bracket')
    const [match] = await getBracketByPhase('p1')
    expect(match.winner_team_id).toBeNull()
  })
})

describe('getKnockoutBrackets', () => {
  it('devolve [] quando não há fases de eliminatórias', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: [] }]) as never
    )
    const { getKnockoutBrackets } = await import('@/lib/queries/bracket')
    expect(await getKnockoutBrackets('t1')).toEqual([])
  })

  it('descarta fases sem jogos e devolve as que têm bracket', async () => {
    // Ordem da fila partilhada: fases, depois getBracketByPhase de cada fase.
    vi.mocked(createClient).mockResolvedValue(
      queryClient([
        { data: [{ id: 'p1', name: 'Meias' }, { id: 'p2', name: 'Final' }] },
        { data: [rawBracketMatch()], error: null }, // p1 → tem jogos
        { data: [], error: null }, // p2 → vazia, descartada
      ]) as never
    )
    const { getKnockoutBrackets } = await import('@/lib/queries/bracket')
    const result = await getKnockoutBrackets('t1')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'p1', name: 'Meias' })
    expect(result[0].matches).toHaveLength(1)
  })
})

describe('getQualifiedTeams', () => {
  const team = (id: string, name: string) => ({
    id,
    name,
    short_name: name.slice(0, 3),
    color_primary: '#000',
    color_secondary: '#fff',
    logo_url: null,
  })

  it('apura os primeiros classificados de cada grupo', async () => {
    // Ordem da fila: settings do torneio, depois getStandingsByTournament.
    vi.mocked(createClient).mockResolvedValue(
      queryClient([
        { data: { settings: { tiebreak_order: ['points'] } } },
        {
          data: [
            {
              id: 'p1',
              name: 'Grupos',
              type: 'group',
              order_index: 0,
              groups: [
                {
                  id: 'g1',
                  name: 'A',
                  order_index: 0,
                  standings: [
                    {
                      team_id: 't1',
                      team: team('t1', 'Alfa'),
                      points: 9,
                      goal_difference: 5,
                      goals_for: 6,
                    },
                    {
                      team_id: 't2',
                      team: team('t2', 'Beta'),
                      points: 6,
                      goal_difference: 2,
                      goals_for: 4,
                    },
                    {
                      team_id: 't3',
                      team: team('t3', 'Gama'),
                      points: 1,
                      goal_difference: -7,
                      goals_for: 1,
                    },
                  ],
                },
              ],
            },
          ],
          error: null,
        },
      ]) as never
    )
    const { getQualifiedTeams } = await import('@/lib/queries/bracket')
    const qualified = await getQualifiedTeams('t1', 2)
    expect(qualified).toHaveLength(2)
    expect(qualified.map((q) => q.team_id)).toEqual(['t1', 't2'])
    expect(qualified[0]).toMatchObject({
      from_group: 'A',
      position: 1,
      team_name: 'Alfa',
    })
  })
})
