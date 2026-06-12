import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { queryClient } from '../../helpers/query-mock'

beforeEach(() => {
  vi.mocked(createClient).mockReset()
})

const matchRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'm1',
  home_team_id: 'a',
  away_team_id: 'b',
  home_score: 0,
  away_score: 0,
  home_score_extra: 0,
  away_score_extra: 0,
  ...overrides,
})

describe('updateStandings', () => {
  it('falha quando o jogo não existe', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([{ data: null }]) as never
    )
    const { updateStandings } = await import('@/lib/actions/standings')
    expect(await updateStandings('m1')).toEqual({
      success: false,
      error: 'Jogo não encontrado.',
    })
  })

  it('não faz nada (sucesso) quando o jogo não pertence a um grupo', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([
        { data: { group_id: null, tournament_id: 't1' } },
      ]) as never
    )
    const { updateStandings } = await import('@/lib/actions/standings')
    expect(await updateStandings('m1')).toEqual({
      success: true,
      data: undefined,
    })
  })

  it('recalcula vitória/derrota/empate e soma cartões', async () => {
    // Ordem da fila de from(): match, tournament, group_teams, matches
    // terminados, match_events (cartões), upsert das standings.
    vi.mocked(createClient).mockResolvedValue(
      queryClient([
        { data: { group_id: 'g1', tournament_id: 't1' } },
        {
          data: {
            settings: {
              scoring: { points_win: 3, points_draw: 1, points_loss: 0 },
            },
          },
        },
        { data: [{ team_id: 'a' }, { team_id: 'b' }, { team_id: 'c' }] },
        {
          data: [
            matchRow({ id: 'm1', home_team_id: 'a', away_team_id: 'b', home_score: 3, away_score: 1 }), // a vence
            matchRow({ id: 'm2', home_team_id: 'a', away_team_id: 'c', home_score: 0, away_score: 2 }), // c vence
            matchRow({ id: 'm3', home_team_id: 'b', away_team_id: 'c', home_score: 1, away_score: 1 }), // empate
          ],
        },
        {
          data: [
            { team_id: 'a', event_type: 'yellow_card' },
            { team_id: 'b', event_type: 'red_card' },
          ],
        },
        { error: null },
      ]) as never
    )
    const { updateStandings } = await import('@/lib/actions/standings')
    expect(await updateStandings('m1')).toEqual({
      success: true,
      data: undefined,
    })
  })

  it('usa pontuação por defeito e cria linhas para equipas sem grupo pré-definido', async () => {
    // tournament null → scoring por defeito; group_teams null → mapa vazio;
    // sem jogos terminados → salta o bloco de cartões.
    vi.mocked(createClient).mockResolvedValue(
      queryClient([
        { data: { group_id: 'g1', tournament_id: 't1' } },
        { data: null },
        { data: null },
        { data: [] },
        { error: null }, // upsert (bloco de cartões saltado)
      ]) as never
    )
    const { updateStandings } = await import('@/lib/actions/standings')
    expect(await updateStandings('m1')).toEqual({
      success: true,
      data: undefined,
    })
  })

  it('devolve erro quando o upsert falha', async () => {
    vi.mocked(createClient).mockResolvedValue(
      queryClient([
        { data: { group_id: 'g1', tournament_id: 't1' } },
        { data: { settings: {} } },
        { data: [{ team_id: 'a' }] },
        { data: [] },
        { error: { message: 'boom' } }, // upsert falha
      ]) as never
    )
    const { updateStandings } = await import('@/lib/actions/standings')
    expect(await updateStandings('m1')).toEqual({
      success: false,
      error: 'Não foi possível actualizar a classificação.',
    })
  })
})
