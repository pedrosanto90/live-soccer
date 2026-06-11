'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/client'
import { useMatch } from '@/contexts/match-context'
import type { MatchAction } from '@/reducers/match-reducer'

const BROADCAST_EVENT = 'match-action'

// Só estas acções fazem sentido espelhar para outros clientes — o tick do
// cronómetro é local em cada painel (derivado de timer_started_at/elapsed).
export type LiveAction = Extract<
  MatchAction,
  { type: 'MATCH_UPDATED' | 'EVENT_ADDED' | 'EVENT_CANCELLED' | 'PENALTY_ADDED' }
>

// Canal de Broadcast por jogo: o painel admin (`source = true`) transmite as
// acções que despacha; os painéis públicos (`source = false`) aplicam-nas. É o
// caminho directo admin → público, independente da base de dados/CDC. Devolve
// uma função `broadcast` (no-op quando não é a fonte).
//
// As acções são idempotentes no reducer, por isso conviver com o fallback de
// postgres_changes (useMatchRealtime) é seguro — entrega dupla não duplica.
export function useMatchBroadcast(
  matchId: string,
  source: boolean
): (action: LiveAction) => void {
  const { dispatch } = useMatch()
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`match-live-${matchId}`, {
      config: { broadcast: { self: false } },
    })

    if (!source) {
      channel.on('broadcast', { event: BROADCAST_EVENT }, ({ payload }) => {
        dispatch(payload as LiveAction)
      })
    }

    channel.subscribe()
    channelRef.current = channel

    return () => {
      channelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [matchId, source, dispatch])

  return useCallback(
    (action: LiveAction) => {
      if (!source) return
      void channelRef.current?.send({
        type: 'broadcast',
        event: BROADCAST_EVENT,
        payload: action,
      })
    },
    [source]
  )
}
