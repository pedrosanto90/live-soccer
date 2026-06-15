import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { queryClient } from '../../helpers/query-mock'

beforeEach(() => {
  vi.mocked(createClient).mockReset()
})

describe('getMatchesByTournament', () => {
  it('devolve [] quando a query falha', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: null, error: { message: 'boom' } }]) as never
    )
    const { getMatchesByTournament } = await import('@/lib/queries/matches')
    expect(await getMatchesByTournament('t1')).toEqual([])
  })

  it('devolve os jogos quando existem', async () => {
    const matches = [{ id: 'm1' }, { id: 'm2' }]
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: matches, error: null }]) as never
    )
    const { getMatchesByTournament } = await import('@/lib/queries/matches')
    expect(await getMatchesByTournament('t1')).toEqual(matches)
  })

  it('aceita filtros de fase, grupo e estado (array)', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: [{ id: 'm1' }], error: null }]) as never
    )
    const { getMatchesByTournament } = await import('@/lib/queries/matches')
    const result = await getMatchesByTournament('t1', {
      phase_id: 'p1',
      group_id: 'g1',
      status: ['scheduled', 'finished'],
    })
    expect(result).toHaveLength(1)
  })

  it('aceita um estado único (não-array)', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: [], error: null }]) as never
    )
    const { getMatchesByTournament } = await import('@/lib/queries/matches')
    expect(await getMatchesByTournament('t1', { status: 'finished' })).toEqual(
      []
    )
  })

  it('exclui jogos de bracket por defeito', async () => {
    const client = queryClient([{ data: [], error: null }])
    vi.mocked(createClient).mockResolvedValue(client as never)
    const { getMatchesByTournament } = await import('@/lib/queries/matches')
    await getMatchesByTournament('t1')

    const builder = vi.mocked(client.from).mock.results[0].value
    expect(builder.is).toHaveBeenCalledWith('bracket_round', null)
  })

  it('inclui jogos de bracket quando includeBracket é true', async () => {
    const client = queryClient([{ data: [], error: null }])
    vi.mocked(createClient).mockResolvedValue(client as never)
    const { getMatchesByTournament } = await import('@/lib/queries/matches')
    await getMatchesByTournament('t1', { includeBracket: true })

    const builder = vi.mocked(client.from).mock.results[0].value
    expect(builder.is).not.toHaveBeenCalled()
  })
})

describe('getMatchById', () => {
  it('devolve null quando o jogo não existe', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: null }]) as never
    )
    const { getMatchById } = await import('@/lib/queries/matches')
    expect(await getMatchById('m1')).toBeNull()
  })

  it('anexa as settings efectivas (merge torneio + override)', async () => {
    const tournamentSettings = {
      match: { half_duration_minutes: 20 },
    }
    vi.mocked(createClient).mockResolvedValue(
      queryClient([
        {
          data: {
            id: 'm1',
            settings_override: null,
            tournament: { id: 't1', name: 'T', settings: tournamentSettings },
          },
        },
      ]) as never
    )
    const { getMatchById } = await import('@/lib/queries/matches')
    const match = await getMatchById('m1')
    expect(match?.id).toBe('m1')
    expect(match?.effective_settings).toEqual(tournamentSettings)
  })
})

describe('getMatchesByPhase', () => {
  it('devolve [] quando a query falha', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: null, error: { message: 'x' } }]) as never
    )
    const { getMatchesByPhase } = await import('@/lib/queries/matches')
    expect(await getMatchesByPhase('p1')).toEqual([])
  })

  it('agrupa os jogos por grupo (sem grupo no fim)', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([
        {
          data: [
            { id: 'm1', group: { id: 'g1', name: 'A' } },
            { id: 'm2', group: { id: 'g1', name: 'A' } },
            { id: 'm3', group: null },
          ],
          error: null,
        },
      ]) as never
    )
    const { getMatchesByPhase } = await import('@/lib/queries/matches')
    const result = await getMatchesByPhase('p1')
    expect(result).toHaveLength(2)
    expect(result[0].group?.id).toBe('g1')
    expect(result[0].matches).toHaveLength(2)
    expect(result[1].group).toBeNull()
    expect(result[1].matches).toHaveLength(1)
  })
})

describe('getRefereesByTournament', () => {
  it('devolve [] quando não há dados', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: null }]) as never
    )
    const { getRefereesByTournament } = await import('@/lib/queries/matches')
    expect(await getRefereesByTournament('t1')).toEqual([])
  })

  it('extrai os árbitros, ignora nulls e ordena por nome', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([
        {
          data: [
            { referees: { id: 'r2', name: 'Bruno' } },
            { referees: null },
            { referees: { id: 'r1', name: 'Ana' } },
          ],
        },
      ]) as never
    )
    const { getRefereesByTournament } = await import('@/lib/queries/matches')
    const result = await getRefereesByTournament('t1')
    expect(result.map((r) => r.name)).toEqual(['Ana', 'Bruno'])
  })
})

describe('getMatchEvents / getMatchPenalties / getActivePlayers', () => {
  it('getMatchEvents devolve [] quando data é null', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: null }]) as never
    )
    const { getMatchEvents } = await import('@/lib/queries/matches')
    expect(await getMatchEvents('m1')).toEqual([])
  })

  it('getMatchEvents devolve os eventos', async () => {
    const events = [{ id: 'e1' }]
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: events }]) as never
    )
    const { getMatchEvents } = await import('@/lib/queries/matches')
    expect(await getMatchEvents('m1')).toEqual(events)
  })

  it('getMatchPenalties devolve [] quando data é null', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: null }]) as never
    )
    const { getMatchPenalties } = await import('@/lib/queries/matches')
    expect(await getMatchPenalties('m1')).toEqual([])
  })

  it('getActivePlayers devolve os jogadores', async () => {
    const players = [{ id: 'p1', name: 'A', number: 1 }]
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: players }]) as never
    )
    const { getActivePlayers } = await import('@/lib/queries/matches')
    expect(await getActivePlayers('team-1')).toEqual(players)
  })
})
