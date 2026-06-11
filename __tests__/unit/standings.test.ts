import { describe, it, expect } from 'vitest'
import { sortStandings, type StandingRow } from '@/lib/standings'

const makeRow = (overrides: Partial<StandingRow>): StandingRow => ({
  id: Math.random().toString(),
  team_id: Math.random().toString(),
  team: {
    id: '1',
    name: 'Equipa',
    short_name: null,
    color_primary: '#000',
    color_secondary: '#fff',
    logo_url: null,
  },
  played: 3,
  won: 1,
  drawn: 1,
  lost: 1,
  goals_for: 3,
  goals_against: 3,
  goal_difference: 0,
  points: 4,
  yellow_cards: 0,
  red_cards: 0,
  ...overrides,
})

describe('sortStandings', () => {
  it('ordena por pontos descendente', () => {
    const rows = [makeRow({ points: 3 }), makeRow({ points: 6 }), makeRow({ points: 1 })]
    const sorted = sortStandings(rows, ['points', 'draw'])
    expect(sorted[0].points).toBe(6)
    expect(sorted[1].points).toBe(3)
    expect(sorted[2].points).toBe(1)
  })

  it('usa diferença de golos como segundo critério', () => {
    const rows = [
      makeRow({ points: 6, goal_difference: 2 }),
      makeRow({ points: 6, goal_difference: 5 }),
    ]
    const sorted = sortStandings(rows, ['points', 'goal_difference', 'draw'])
    expect(sorted[0].goal_difference).toBe(5)
  })

  it('usa golos marcados como terceiro critério', () => {
    const rows = [
      makeRow({ points: 6, goal_difference: 3, goals_for: 4 }),
      makeRow({ points: 6, goal_difference: 3, goals_for: 7 }),
    ]
    const sorted = sortStandings(rows, ['points', 'goal_difference', 'goals_scored', 'draw'])
    expect(sorted[0].goals_for).toBe(7)
  })

  it('cartões amarelos — menor é melhor', () => {
    const rows = [
      makeRow({ points: 6, goal_difference: 0, goals_for: 3, yellow_cards: 3 }),
      makeRow({ points: 6, goal_difference: 0, goals_for: 3, yellow_cards: 1 }),
    ]
    const sorted = sortStandings(
      rows,
      ['points', 'goal_difference', 'goals_scored', 'yellow_cards', 'draw']
    )
    expect(sorted[0].yellow_cards).toBe(1)
  })

  it('golos sofridos — menor é melhor', () => {
    const rows = [
      makeRow({ points: 6, goal_difference: 0, goals_for: 3, goals_against: 5 }),
      makeRow({ points: 6, goal_difference: 0, goals_for: 3, goals_against: 2 }),
    ]
    const sorted = sortStandings(
      rows,
      ['points', 'goal_difference', 'goals_scored', 'goals_conceded', 'draw']
    )
    expect(sorted[0].goals_against).toBe(2)
  })

  it('ordena correctamente com diferença de golos negativa', () => {
    const rows = [
      makeRow({ points: 3, goal_difference: -2 }),
      makeRow({ points: 3, goal_difference: 1 }),
    ]
    const sorted = sortStandings(rows, ['points', 'goal_difference', 'draw'])
    expect(sorted[0].goal_difference).toBe(1)
    expect(sorted[1].goal_difference).toBe(-2)
  })

  it('head_to_head é tratado como empate (não altera a ordem)', () => {
    const a = makeRow({ id: 'a', points: 6 })
    const b = makeRow({ id: 'b', points: 6 })
    const sorted = sortStandings([a, b], ['points', 'head_to_head', 'draw'])
    expect(sorted.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('não altera o array original', () => {
    const rows = [makeRow({ points: 3 }), makeRow({ points: 6 })]
    const original = [...rows]
    sortStandings(rows, ['points', 'draw'])
    expect(rows[0].points).toBe(original[0].points)
    expect(rows[1].points).toBe(original[1].points)
  })
})
