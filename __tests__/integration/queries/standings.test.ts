import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { queryClient } from '../../helpers/query-mock'

beforeEach(() => {
  vi.mocked(createClient).mockReset()
})

const team = {
  id: 'team-1',
  name: 'Equipa 1',
  short_name: 'E1',
  color_primary: '#000',
  color_secondary: '#fff',
  logo_url: null,
}

describe('getStandingsByTournament', () => {
  it('devolve [] quando a query falha', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: null, error: { message: 'x' } }]) as never
    )
    const { getStandingsByTournament } = await import(
      '@/lib/queries/standings'
    )
    expect(await getStandingsByTournament('t1')).toEqual([])
  })

  it('ordena grupos por order_index e filtra standings sem equipa', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([
        {
          data: [
            {
              id: 'p1',
              name: 'Grupos',
              type: 'group',
              order_index: 0,
              groups: [
                {
                  id: 'g2',
                  name: 'B',
                  order_index: 1,
                  standings: [{ team_id: 'team-1', team }],
                },
                {
                  id: 'g1',
                  name: 'A',
                  order_index: 0,
                  standings: [
                    { team_id: 'team-1', team },
                    { team_id: 'x', team: null },
                  ],
                },
              ],
            },
          ],
          error: null,
        },
      ]) as never
    )
    const { getStandingsByTournament } = await import(
      '@/lib/queries/standings'
    )
    const [phase] = await getStandingsByTournament('t1')
    expect(phase.groups.map((g) => g.group.name)).toEqual(['A', 'B'])
    // a standing com team null é removida do grupo A
    expect(phase.groups[0].standings).toHaveLength(1)
  })
})

describe('getStandingsByGroup', () => {
  it('devolve [] quando a query falha', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: null, error: { message: 'x' } }]) as never
    )
    const { getStandingsByGroup } = await import('@/lib/queries/standings')
    expect(await getStandingsByGroup('g1')).toEqual([])
  })

  it('filtra standings sem equipa', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([
        {
          data: [
            { team_id: 'team-1', team },
            { team_id: 'x', team: null },
          ],
          error: null,
        },
      ]) as never
    )
    const { getStandingsByGroup } = await import('@/lib/queries/standings')
    const result = await getStandingsByGroup('g1')
    expect(result).toHaveLength(1)
    expect(result[0].team_id).toBe('team-1')
  })
})
