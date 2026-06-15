import type { Match, MatchEvent, PenaltyKick } from '@/types/database'

// ─── Estado ───────────────────────────────────────────────────────────────

export interface MatchState {
  match: Match
  events: MatchEvent[]
  penalties: PenaltyKick[]
  timerRunning: boolean
  elapsedSecs: number // segundos decorridos desde o início da parte (local)
  isLoading: boolean
}

// ─── Acções ───────────────────────────────────────────────────────────────

export type MatchAction =
  | { type: 'MATCH_UPDATED'; payload: Match }
  | { type: 'EVENT_ADDED'; payload: MatchEvent }
  | { type: 'EVENT_UPDATED'; payload: MatchEvent }
  | { type: 'EVENT_CANCELLED'; payload: string } // eventId
  | { type: 'PENALTY_ADDED'; payload: PenaltyKick }
  | { type: 'TIMER_STARTED' }
  | { type: 'TIMER_PAUSED'; payload: number } // elapsedSecs no momento da pausa
  | { type: 'TIMER_RESET' }
  | { type: 'TIMER_SET_MANUAL'; payload: number } // elapsedSecs
  | { type: 'TIMER_TICK' }
  | { type: 'SET_LOADING'; payload: boolean }

// Recalcula os segundos decorridos a partir dos campos persistidos na BD.
// Quando o timer está a correr, soma o tempo acumulado ao intervalo desde
// `timer_started_at`; caso contrário usa apenas o tempo acumulado.
function deriveElapsed(match: Match): { running: boolean; elapsedSecs: number } {
  const running = !!match.timer_started_at
  const now = Date.now() / 1000
  const startedAtSecs = match.timer_started_at
    ? new Date(match.timer_started_at).getTime() / 1000
    : 0
  const elapsedSecs = running
    ? (match.timer_elapsed_secs ?? 0) + (now - startedAtSecs)
    : match.timer_elapsed_secs ?? 0
  return { running, elapsedSecs }
}

// ─── Reducer ──────────────────────────────────────────────────────────────

export function matchReducer(state: MatchState, action: MatchAction): MatchState {
  switch (action.type) {
    case 'MATCH_UPDATED': {
      const { running, elapsedSecs } = deriveElapsed(action.payload)
      return {
        ...state,
        match: action.payload,
        timerRunning: running,
        elapsedSecs,
        isLoading: false,
      }
    }

    case 'EVENT_ADDED':
      // Ignora duplicados (o operador também recebe o próprio INSERT do Realtime).
      if (state.events.some((e) => e.id === action.payload.id)) return state
      return { ...state, events: [action.payload, ...state.events] }

    case 'EVENT_UPDATED':
      return {
        ...state,
        events: state.events.map((e) =>
          e.id === action.payload.id ? action.payload : e
        ),
      }

    case 'EVENT_CANCELLED':
      return {
        ...state,
        events: state.events.map((e) =>
          e.id === action.payload ? { ...e, is_cancelled: true } : e
        ),
      }

    case 'PENALTY_ADDED':
      if (state.penalties.some((p) => p.id === action.payload.id)) return state
      return { ...state, penalties: [...state.penalties, action.payload] }

    case 'TIMER_STARTED':
      return { ...state, timerRunning: true }

    case 'TIMER_PAUSED':
      return { ...state, timerRunning: false, elapsedSecs: action.payload }

    case 'TIMER_RESET':
      return { ...state, elapsedSecs: 0, timerRunning: false }

    case 'TIMER_SET_MANUAL':
      return { ...state, elapsedSecs: action.payload, timerRunning: false }

    case 'TIMER_TICK':
      return state.timerRunning
        ? { ...state, elapsedSecs: state.elapsedSecs + 1 }
        : state

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }

    default:
      return state
  }
}

// ─── Estado inicial ───────────────────────────────────────────────────────

export function createInitialState(
  match: Match,
  events: MatchEvent[],
  penalties: PenaltyKick[]
): MatchState {
  const { running, elapsedSecs } = deriveElapsed(match)
  return {
    match,
    events,
    penalties,
    timerRunning: running,
    elapsedSecs,
    isLoading: false,
  }
}
