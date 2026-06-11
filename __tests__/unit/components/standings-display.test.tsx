import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { StandingsTable } from '@/components/standings/standings-table'
import type { StandingRow } from '@/lib/standings'

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

const tiebreak = ['points', 'goal_difference', 'draw'] as const

describe('StandingsTable', () => {
  it('renderiza uma linha por equipa', () => {
    const rows = [
      makeRow({ team: { ...makeRow({}).team, name: 'A' } }),
      makeRow({ team: { ...makeRow({}).team, name: 'B' } }),
      makeRow({ team: { ...makeRow({}).team, name: 'C' } }),
    ]
    render(<StandingsTable standings={rows} tiebreakOrder={[...tiebreak]} />)
    expect(screen.getAllByTestId('standings-row')).toHaveLength(3)
  })

  it('a equipa com mais pontos aparece na posição 1', () => {
    const rows = [
      makeRow({ points: 3, team: { ...makeRow({}).team, name: 'Segunda' } }),
      makeRow({ points: 9, team: { ...makeRow({}).team, name: 'Primeira' } }),
    ]
    render(<StandingsTable standings={rows} tiebreakOrder={[...tiebreak]} />)
    const firstRow = screen.getAllByTestId('standings-row')[0]
    expect(firstRow).toHaveTextContent('1')
    expect(firstRow).toHaveTextContent('Primeira')
  })

  it('diferença de golos positiva mostra o sinal +', () => {
    const rows = [makeRow({ goal_difference: 4 })]
    render(<StandingsTable standings={rows} tiebreakOrder={[...tiebreak]} />)
    expect(screen.getByText('+4')).toBeInTheDocument()
  })

  it('diferença de golos negativa mostra o sinal -', () => {
    const rows = [makeRow({ goal_difference: -3 })]
    render(<StandingsTable standings={rows} tiebreakOrder={[...tiebreak]} />)
    expect(screen.getByText('-3')).toBeInTheDocument()
  })

  it('marca a última linha de apuramento com a divisória', () => {
    const rows = [
      makeRow({ points: 9 }),
      makeRow({ points: 6 }),
      makeRow({ points: 3 }),
      makeRow({ points: 1 }),
    ]
    render(
      <StandingsTable
        standings={rows}
        tiebreakOrder={[...tiebreak]}
        qualifyingSpots={2}
      />
    )
    const displayed = screen.getAllByTestId('standings-row')
    expect(displayed[1].className).toContain('border-b-primary/30')
    expect(displayed[0].className).not.toContain('border-b-primary/30')
  })
})
