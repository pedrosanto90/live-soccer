import { describe, it, expect } from 'vitest'

import {
  formatEventTime,
  getCurrentFouls,
  getNextPenaltyKick,
  getPeriodLabel,
  isPenaltySeriesComplete,
} from '@/lib/utils'
import type { Match, PenaltyKick } from '@/types/database'

const match = {
  home_fouls_h1: 4,
  away_fouls_h1: 1,
  home_fouls_h2: 2,
  away_fouls_h2: 3,
  home_fouls_extra: 5,
  away_fouls_extra: 0,
} as unknown as Match

describe('getCurrentFouls', () => {
  it('lê a coluna certa por parte e lado', () => {
    expect(getCurrentFouls(match, 'home', 'first_half')).toBe(4)
    expect(getCurrentFouls(match, 'away', 'first_half')).toBe(1)
    expect(getCurrentFouls(match, 'home', 'second_half')).toBe(2)
    expect(getCurrentFouls(match, 'away', 'second_half')).toBe(3)
    expect(getCurrentFouls(match, 'home', 'extra_first')).toBe(5)
    expect(getCurrentFouls(match, 'home', 'extra_second')).toBe(5)
  })

  it('devolve 0 sem parte', () => {
    expect(getCurrentFouls(match, 'home', null)).toBe(0)
    expect(getCurrentFouls(match, 'home', 'penalties')).toBe(0)
  })
})

describe('getPeriodLabel', () => {
  it('traduz cada período', () => {
    expect(getPeriodLabel('first_half')).toBe('1.ª parte')
    expect(getPeriodLabel('second_half')).toBe('2.ª parte')
    expect(getPeriodLabel('extra_first')).toBe('1.ª parte extra')
    expect(getPeriodLabel('extra_second')).toBe('2.ª parte extra')
    expect(getPeriodLabel('penalties')).toBe('Penáltis')
    expect(getPeriodLabel(null)).toBe('')
  })
})

describe('formatEventTime', () => {
  it('arredonda para cima e nunca abaixo de 1', () => {
    expect(formatEventTime(0)).toBe('1')
    expect(formatEventTime(50)).toBe('1')
    expect(formatEventTime(61)).toBe('2')
    expect(formatEventTime(120)).toBe('2')
  })
})

function kick(team: string, scored: boolean): PenaltyKick {
  return { team_id: team, scored } as PenaltyKick
}

describe('getNextPenaltyKick', () => {
  it('a casa bate primeiro e as equipas alternam', () => {
    expect(getNextPenaltyKick([], 'h', 'a')).toEqual({ teamId: 'h', kickOrder: 1 })
    expect(getNextPenaltyKick([kick('h', true)], 'h', 'a')).toEqual({
      teamId: 'a',
      kickOrder: 1,
    })
    expect(
      getNextPenaltyKick([kick('h', true), kick('a', false)], 'h', 'a')
    ).toEqual({ teamId: 'h', kickOrder: 2 })
  })
})

describe('isPenaltySeriesComplete', () => {
  it('false enquanto a série regular decorre', () => {
    expect(isPenaltySeriesComplete([], 3)).toBe(false)
    expect(isPenaltySeriesComplete([kick('h', true), kick('a', true)], 3)).toBe(
      false
    )
  })

  it('detecta vencedor antecipado', () => {
    // Casa 3/3, fora 0/2 — restam à fora 1 pontapé que não chega.
    const kicks = [
      kick('h', true),
      kick('a', false),
      kick('h', true),
      kick('a', false),
      kick('h', true),
    ]
    expect(isPenaltySeriesComplete(kicks, 3)).toBe(true)
  })

  it('continua (morte súbita) se empatado após a série regular', () => {
    const kicks = [
      kick('h', true),
      kick('a', true),
      kick('h', false),
      kick('a', false),
      kick('h', true),
      kick('a', true),
    ]
    expect(isPenaltySeriesComplete(kicks, 3)).toBe(false)
  })

  it('termina quando há diferença com o mesmo número de pontapés', () => {
    const kicks = [
      kick('h', true),
      kick('a', true),
      kick('h', true),
      kick('a', false),
      kick('h', true),
      kick('a', true),
    ]
    expect(isPenaltySeriesComplete(kicks, 3)).toBe(true)
  })
})
