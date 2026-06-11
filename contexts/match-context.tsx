'use client'

import { createContext, useContext, useReducer, type Dispatch } from 'react'

import {
  matchReducer,
  createInitialState,
  type MatchState,
  type MatchAction,
} from '@/reducers/match-reducer'
import type { Match, MatchEvent, PenaltyKick } from '@/types/database'

interface MatchContextValue {
  state: MatchState
  dispatch: Dispatch<MatchAction>
}

const MatchContext = createContext<MatchContextValue | null>(null)

export function MatchProvider({
  children,
  initialMatch,
  initialEvents,
  initialPenalties,
}: {
  children: React.ReactNode
  initialMatch: Match
  initialEvents: MatchEvent[]
  initialPenalties: PenaltyKick[]
}) {
  const [state, dispatch] = useReducer(
    matchReducer,
    createInitialState(initialMatch, initialEvents, initialPenalties)
  )

  return (
    <MatchContext.Provider value={{ state, dispatch }}>
      {children}
    </MatchContext.Provider>
  )
}

export function useMatch() {
  const ctx = useContext(MatchContext)
  if (!ctx) throw new Error('useMatch deve ser usado dentro de MatchProvider')
  return ctx
}
