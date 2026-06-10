import { describe, it, expect } from 'vitest'
import { tournamentSchema } from '@/lib/validations/tournament'

const validTournament = {
  name: 'Torneio de Verão 2025',
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
  tiebreak_order: ['points', 'goal_difference', 'goals_scored', 'draw'],
}

describe('tournamentSchema', () => {
  it('valida um torneio completo', () => {
    expect(tournamentSchema.safeParse(validTournament).success).toBe(true)
  })

  it('rejeita nome com menos de 3 caracteres', () => {
    const result = tournamentSchema.safeParse({ ...validTournament, name: 'AB' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe(
      'Nome deve ter pelo menos 3 caracteres'
    )
  })

  it('rejeita duração de parte inferior a 5 minutos', () => {
    const result = tournamentSchema.safeParse({
      ...validTournament,
      match: { ...validTournament.match, half_duration_minutes: 3 },
    })
    expect(result.success).toBe(false)
  })

  it('rejeita tiebreak_order vazio', () => {
    const result = tournamentSchema.safeParse({
      ...validTournament,
      tiebreak_order: [],
    })
    expect(result.success).toBe(false)
  })

  it('aceita torneio sem datas (campos opcionais)', () => {
    const { ...withoutDates } = validTournament
    expect(tournamentSchema.safeParse(withoutDates).success).toBe(true)
  })

  it('aplica os defaults dos campos numéricos quando omitidos', () => {
    const result = tournamentSchema.safeParse({
      name: 'Torneio mínimo',
      tiebreak_order: ['points', 'draw'],
      match: {},
      scoring: {},
      cards: {},
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.match.half_duration_minutes).toBe(20)
      expect(result.data.scoring.points_win).toBe(3)
      expect(result.data.visibility).toBe('public')
    }
  })
})
