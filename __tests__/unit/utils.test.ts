import { describe, it, expect } from 'vitest'
import {
  formatDate,
  generateSlug,
  buildTournamentSettings,
  parseTournamentSettings,
} from '@/lib/utils'
import type { TournamentInput } from '@/lib/validations/tournament'

describe('formatDate', () => {
  it('formata uma data em português', () => {
    expect(formatDate('2025-06-12')).toBe('12 de junho de 2025')
  })
  it('retorna string vazia para input inválido', () => {
    expect(formatDate('')).toBe('')
    expect(formatDate('não-é-data')).toBe('')
  })
})

describe('generateSlug', () => {
  it('converte nome para slug minúsculo e sem acentos', () => {
    expect(generateSlug('Torneio de Verão')).toBe('torneio-de-verao')
  })
  it('remove caracteres especiais', () => {
    expect(generateSlug('Torneio #1!')).toBe('torneio-1')
  })
  it('acrescenta sufixo quando fornecido', () => {
    expect(generateSlug('Torneio', 'abc1')).toBe('torneio-abc1')
  })
})

const baseInput: TournamentInput = {
  name: 'Torneio',
  visibility: 'public',
  match: {
    half_duration_minutes: 20,
    half_time_duration_minutes: 5,
    extra_time_duration_minutes: 5,
    max_fouls_per_team_per_half: 5,
    penalty_shootout_kicks: 5,
  },
  scoring: { points_win: 3, points_draw: 1, points_loss: 0 },
  cards: { yellow_cards_for_suspension: 3, red_card_suspension_matches: 1 },
  tiebreak_order: ['points', 'goal_difference', 'draw'],
}

describe('buildTournamentSettings', () => {
  it('constrói o objecto settings a partir do input do formulário', () => {
    const settings = buildTournamentSettings({
      ...baseInput,
      match: { ...baseInput.match, half_duration_minutes: 25 },
    })
    expect(settings.match.half_duration_minutes).toBe(25)
    expect(settings.scoring.points_win).toBe(3)
    expect(settings.tiebreak_order).toEqual(['points', 'goal_difference', 'draw'])
  })
})

describe('parseTournamentSettings', () => {
  it('retorna defaults quando settings está vazio', () => {
    const parsed = parseTournamentSettings({})
    expect(parsed.match.half_duration_minutes).toBe(20)
    expect(parsed.match.max_fouls_per_team_per_half).toBe(5)
    expect(parsed.scoring.points_win).toBe(3)
    expect(parsed.cards.yellow_cards_for_suspension).toBe(3)
    expect(parsed.tiebreak_order.length).toBeGreaterThan(0)
  })

  it('faz merge dos valores guardados com os defaults', () => {
    const parsed = parseTournamentSettings({
      match: { half_duration_minutes: 25 },
    })
    expect(parsed.match.half_duration_minutes).toBe(25)
    expect(parsed.match.max_fouls_per_team_per_half).toBe(5) // default mantido
  })

  it('usa a ordem de desempate guardada quando não está vazia', () => {
    const parsed = parseTournamentSettings({
      tiebreak_order: ['goal_difference', 'points', 'draw'],
    })
    expect(parsed.tiebreak_order).toEqual(['goal_difference', 'points', 'draw'])
  })
})
