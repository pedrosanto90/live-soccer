'use client'

import { useEffect, useRef } from 'react'

import { useMatch } from '@/contexts/match-context'
import { syncTimer } from '@/lib/actions/match-admin'

export interface UseTimerReturn {
  displayTime: string // "14:32" — tempo decorrido
  remainingTime: string // "05:28" — tempo restante
  isOvertime: boolean // true quando passou o tempo normal
  isTimeUp: boolean // true quando o tempo restante chegou a 00:00
  elapsedSecs: number
}

function formatTime(secs: number): string {
  const s = Math.max(0, Math.floor(secs))
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, '0')
  const ss = (s % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

// Faz avançar o relógio local 1s/s enquanto a correr e sincroniza o tempo
// acumulado com a BD a cada 30s (chamada silenciosa). A BD continua a ser a
// fonte de verdade — qualquer `MATCH_UPDATED` recalcula `elapsedSecs`.
export function useTimer(halfDurationSecs: number, matchId: string): UseTimerReturn {
  const { state, dispatch } = useMatch()
  const { timerRunning, elapsedSecs } = state

  // Ref sempre actualizado com o último valor para o sync não usar uma
  // closure obsoleta.
  const elapsedRef = useRef(elapsedSecs)
  useEffect(() => {
    elapsedRef.current = elapsedSecs
  }, [elapsedSecs])

  useEffect(() => {
    if (!timerRunning) return

    let sinceSync = 0
    const interval = setInterval(() => {
      dispatch({ type: 'TIMER_TICK' })
      sinceSync += 1

      if (sinceSync >= 30) {
        sinceSync = 0
        void syncTimer(matchId, Math.round(elapsedRef.current))
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [timerRunning, matchId, dispatch])

  const remaining = Math.max(0, halfDurationSecs - elapsedSecs)
  // O tempo decorrido apresentado pára no tempo definido — tal como o restante
  // pára em 00:00. O `elapsedSecs` cru continua a ser sincronizado com a BD.
  const displayElapsed = Math.min(elapsedSecs, halfDurationSecs)

  return {
    displayTime: formatTime(displayElapsed),
    remainingTime: formatTime(remaining),
    isOvertime: elapsedSecs > halfDurationSecs,
    isTimeUp: remaining <= 0,
    elapsedSecs,
  }
}
