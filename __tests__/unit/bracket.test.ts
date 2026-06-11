import { describe, it, expect } from 'vitest'

import {
  generateBracket,
  calculateRounds,
  calculateFirstRoundSize,
  generateFirstRoundMatchups,
  getRoundLabel,
  getNextMatchPosition,
  getNextMatchSlot,
  type QualifiedTeam,
} from '@/lib/bracket'

const makeTeam = (groupPos: number, groupName: string): QualifiedTeam => ({
  team_id: `${groupName}-${groupPos}`,
  team_name: `Equipa ${groupName}${groupPos}`,
  team_short_name: null,
  color_primary: '#000',
  color_secondary: '#fff',
  from_group: groupName,
  position: groupPos,
})

describe('calculateRounds', () => {
  it('2 equipas → 1 ronda', () => expect(calculateRounds(2)).toBe(1))
  it('4 equipas → 2 rondas', () => expect(calculateRounds(4)).toBe(2))
  it('8 equipas → 3 rondas', () => expect(calculateRounds(8)).toBe(3))
  it('6 equipas → 3 rondas (arredonda para cima)', () =>
    expect(calculateRounds(6)).toBe(3))
})

describe('calculateFirstRoundSize', () => {
  it('4 equipas → 4 slots', () => expect(calculateFirstRoundSize(4)).toBe(4))
  it('6 equipas → 8 slots', () => expect(calculateFirstRoundSize(6)).toBe(8))
  it('5 equipas → 8 slots', () => expect(calculateFirstRoundSize(5)).toBe(8))
})

describe('generateFirstRoundMatchups', () => {
  it('4 equipas — evita mesmo grupo na 1.ª ronda', () => {
    const teams = [
      makeTeam(1, 'A'),
      makeTeam(2, 'A'),
      makeTeam(1, 'B'),
      makeTeam(2, 'B'),
    ]
    const matchups = generateFirstRoundMatchups(teams)
    matchups.forEach(({ home, away }) => {
      if (home && away) {
        expect(home.from_group).not.toBe(away.from_group)
      }
    })
  })

  it('8 equipas (4 grupos) — evita mesmo grupo na 1.ª ronda', () => {
    const teams = ['A', 'B', 'C', 'D'].flatMap((g) => [makeTeam(1, g), makeTeam(2, g)])
    const matchups = generateFirstRoundMatchups(teams)
    matchups.forEach(({ home, away }) => {
      if (home && away) {
        expect(home.from_group).not.toBe(away.from_group)
      }
    })
  })

  it('6 equipas — gera 4 slots com 2 byes', () => {
    const teams = [
      makeTeam(1, 'A'),
      makeTeam(2, 'A'),
      makeTeam(1, 'B'),
      makeTeam(2, 'B'),
      makeTeam(1, 'C'),
      makeTeam(2, 'C'),
    ]
    const matchups = generateFirstRoundMatchups(teams)
    expect(matchups).toHaveLength(4)
    const byes = matchups.filter((m) => m.home === null || m.away === null)
    expect(byes).toHaveLength(2)
  })
})

describe('getNextMatchPosition', () => {
  it('position 0 → next 0', () => expect(getNextMatchPosition(0)).toBe(0))
  it('position 1 → next 0', () => expect(getNextMatchPosition(1)).toBe(0))
  it('position 2 → next 1', () => expect(getNextMatchPosition(2)).toBe(1))
  it('position 3 → next 1', () => expect(getNextMatchPosition(3)).toBe(1))
})

describe('getNextMatchSlot', () => {
  it('position par → home', () => {
    expect(getNextMatchSlot(0)).toBe('home')
    expect(getNextMatchSlot(2)).toBe('home')
  })
  it('position ímpar → away', () => {
    expect(getNextMatchSlot(1)).toBe('away')
    expect(getNextMatchSlot(3)).toBe('away')
  })
})

describe('generateBracket', () => {
  it('4 equipas → 2 rondas (meias + final)', () => {
    const teams = [
      makeTeam(1, 'A'),
      makeTeam(2, 'A'),
      makeTeam(1, 'B'),
      makeTeam(2, 'B'),
    ]
    const bracket = generateBracket(teams)
    expect(bracket).toHaveLength(2)
    expect(bracket[0].round).toBe(2) // meias
    expect(bracket[1].round).toBe(1) // final
  })

  it('8 equipas → 3 rondas', () => {
    const teams = Array.from({ length: 8 }, (_, i) =>
      makeTeam((i % 2) + 1, String.fromCharCode(65 + Math.floor(i / 2)))
    )
    const bracket = generateBracket(teams)
    expect(bracket).toHaveLength(3)
  })

  it('cada slot tem next_match_position correcto', () => {
    const teams = [
      makeTeam(1, 'A'),
      makeTeam(2, 'A'),
      makeTeam(1, 'B'),
      makeTeam(2, 'B'),
    ]
    const bracket = generateBracket(teams)
    const firstRound = bracket[0]
    firstRound.slots.forEach((slot, i) => {
      expect(slot.next_match_position).toBe(getNextMatchPosition(i))
    })
  })

  it('6 equipas → 3 rondas com 2 byes na 1.ª ronda', () => {
    const teams = [
      makeTeam(1, 'A'),
      makeTeam(2, 'A'),
      makeTeam(1, 'B'),
      makeTeam(2, 'B'),
      makeTeam(1, 'C'),
      makeTeam(2, 'C'),
    ]
    const bracket = generateBracket(teams)
    expect(bracket).toHaveLength(3)
    const byes = bracket[0].slots.filter((s) => s.is_bye)
    expect(byes).toHaveLength(2)
  })
})

describe('getRoundLabel', () => {
  it('round 1 → Final', () => expect(getRoundLabel(1)).toBe('Final'))
  it('round 2 → Meia-final', () => expect(getRoundLabel(2)).toBe('Meia-final'))
  it('round 4 → Quarto-de-final', () =>
    expect(getRoundLabel(4)).toBe('Quarto-de-final'))
})
