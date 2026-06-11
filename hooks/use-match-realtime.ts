'use client'

import { useEffect } from 'react'

import { createClient } from '@/lib/supabase/client'
import { useMatch } from '@/contexts/match-context'
import type { Match, MatchEvent, PenaltyKick } from '@/types/database'

// Subscreve às mudanças do jogo via Supabase Realtime e despacha as acções
// correspondentes. É o único ponto que lê do Supabase em runtime — tanto o
// painel de administração como o público partilham esta lógica.
export function useMatchRealtime(matchId: string) {
  const { dispatch } = useMatch()

  useEffect(() => {
    const supabase = createClient()

    // Garante que o socket de Realtime usa o token da sessão antes de subscrever
    // — caso contrário as alterações filtradas por RLS (torneios privados, ou
    // qualquer política que dependa do utilizador) não são entregues.
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) supabase.realtime.setAuth(data.session.access_token)
    })

    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          dispatch({ type: 'MATCH_UPDATED', payload: payload.new as Match })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'match_events',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          dispatch({ type: 'EVENT_ADDED', payload: payload.new as MatchEvent })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'match_events',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const next = payload.new as MatchEvent
          if (next.is_cancelled) {
            dispatch({ type: 'EVENT_CANCELLED', payload: next.id })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'penalty_kicks',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          dispatch({ type: 'PENALTY_ADDED', payload: payload.new as PenaltyKick })
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [matchId, dispatch])
}
