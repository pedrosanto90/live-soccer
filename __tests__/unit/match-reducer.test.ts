import { describe, it, expect } from 'vitest'

import { matchReducer, createInitialState } from '@/reducers/match-reducer'
import type { Match } from '@/types/database'

const baseMatch = {
  id: 'match-1',
  home_team_id: 'home',
  away_team_id: 'away',
  home_score: 0,
  away_score: 0,
  home_fouls_h1: 0,
  away_fouls_h1: 0,
  home_fouls_h2: 0,
  away_fouls_h2: 0,
  home_fouls_extra: 0,
  away_fouls_extra: 0,
  status: 'scheduled',
  current_period: null,
  timer_elapsed_secs: 0,
  timer_started_at: null,
} as unknown as Match

describe('matchReducer', () => {
  it('TIMER_TICK incrementa elapsedSecs quando timerRunning', () => {
    const state = {
      ...createInitialState(baseMatch, [], []),
      timerRunning: true,
      elapsedSecs: 10,
    }
    const next = matchReducer(state, { type: 'TIMER_TICK' })
    expect(next.elapsedSecs).toBe(11)
  })

  it('TIMER_TICK não incrementa quando timer parado', () => {
    const state = {
      ...createInitialState(baseMatch, [], []),
      timerRunning: false,
      elapsedSecs: 10,
    }
    const next = matchReducer(state, { type: 'TIMER_TICK' })
    expect(next.elapsedSecs).toBe(10)
  })

  it('TIMER_RESET volta a zero', () => {
    const state = { ...createInitialState(baseMatch, [], []), elapsedSecs: 500 }
    const next = matchReducer(state, { type: 'TIMER_RESET' })
    expect(next.elapsedSecs).toBe(0)
    expect(next.timerRunning).toBe(false)
  })

  it('EVENT_ADDED adiciona evento ao início da lista', () => {
    const state = createInitialState(baseMatch, [], [])
    const event = { id: 'e1', event_type: 'goal' } as never
    const next = matchReducer(state, { type: 'EVENT_ADDED', payload: event })
    expect(next.events[0].id).toBe('e1')
  })

  it('EVENT_ADDED ignora duplicados (eco do Realtime)', () => {
    const event = { id: 'e1', event_type: 'goal' } as never
    const state = createInitialState(baseMatch, [event], [])
    const next = matchReducer(state, { type: 'EVENT_ADDED', payload: event })
    expect(next.events).toHaveLength(1)
  })

  it('EVENT_CANCELLED marca evento como cancelado', () => {
    const event = { id: 'e1', is_cancelled: false } as never
    const state = createInitialState(baseMatch, [event], [])
    const next = matchReducer(state, { type: 'EVENT_CANCELLED', payload: 'e1' })
    expect(next.events[0].is_cancelled).toBe(true)
  })

  it('TIMER_SET_MANUAL define os segundos correctos', () => {
    const state = createInitialState(baseMatch, [], [])
    const next = matchReducer(state, { type: 'TIMER_SET_MANUAL', payload: 754 })
    expect(next.elapsedSecs).toBe(754)
    expect(next.timerRunning).toBe(false)
  })

  it('PENALTY_ADDED acrescenta um pontapé e ignora duplicados', () => {
    const kick = { id: 'p1', scored: true } as never
    const state = createInitialState(baseMatch, [], [])
    const added = matchReducer(state, { type: 'PENALTY_ADDED', payload: kick })
    expect(added.penalties).toHaveLength(1)
    const again = matchReducer(added, { type: 'PENALTY_ADDED', payload: kick })
    expect(again.penalties).toHaveLength(1)
  })

  it('MATCH_UPDATED recalcula o timer a partir dos campos da BD', () => {
    const running = {
      ...baseMatch,
      timer_elapsed_secs: 120,
      timer_started_at: new Date().toISOString(),
    } as Match
    const state = createInitialState(baseMatch, [], [])
    const next = matchReducer(state, { type: 'MATCH_UPDATED', payload: running })
    expect(next.timerRunning).toBe(true)
    expect(next.elapsedSecs).toBeGreaterThanOrEqual(120)
  })
})
