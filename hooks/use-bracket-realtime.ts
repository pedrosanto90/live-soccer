'use client'

import { useEffect, useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { computeWinner } from '@/lib/bracket'
import type { BracketMatchRow, BracketTeamLite } from '@/lib/queries/bracket'
import type { MatchStatus } from '@/types/database'

// Forma das colunas entregues pelo Realtime (replica identity full → row
// completa). Não traz os embeds das equipas, por isso resolvemos o nome a
// partir do mapa construído com os dados iniciais.
interface MatchRowPayload {
  id: string
  status: MatchStatus
  home_team_id: string | null
  away_team_id: string | null
  home_score: number
  away_score: number
  home_score_extra: number
  away_score_extra: number
  home_penalties: number
  away_penalties: number
  next_match_id: string | null
  next_match_slot: 'home' | 'away' | null
  bracket_round: number | null
  bracket_position: number | null
}

// Subscreve à tabela `matches` (filtrada pela fase) e mantém os jogos do bracket
// sincronizados em tempo real: resultados, mudanças de estado e equipas
// preenchidas automaticamente pelo `advanceWinner`.
export function useBracketRealtime(
  phaseId: string,
  initialMatches: BracketMatchRow[]
): BracketMatchRow[] {
  const [matches, setMatches] = useState<BracketMatchRow[]>(initialMatches)

  // Re-hidrata quando o servidor envia novos dados (ex.: após router.refresh).
  const [prevInitial, setPrevInitial] = useState(initialMatches)
  if (prevInitial !== initialMatches) {
    setPrevInitial(initialMatches)
    setMatches(initialMatches)
  }

  // Qualquer equipa que apareça num slot futuro já consta de uma ronda
  // anterior, por isso o mapa id→equipa cobre todos os avanços possíveis.
  const teamMap = useMemo(() => {
    const map: Record<string, BracketTeamLite> = {}
    for (const m of initialMatches) {
      if (m.home_team) map[m.home_team.id] = m.home_team
      if (m.away_team) map[m.away_team.id] = m.away_team
    }
    return map
  }, [initialMatches])

  useEffect(() => {
    const supabase = createClient()

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) supabase.realtime.setAuth(data.session.access_token)
    })

    function applyRow(row: MatchRowPayload) {
      setMatches((prev) =>
        prev.map((m) => {
          if (m.id !== row.id) return m
          const home_team = row.home_team_id
            ? teamMap[row.home_team_id] ?? m.home_team
            : null
          const away_team = row.away_team_id
            ? teamMap[row.away_team_id] ?? m.away_team
            : null
          return {
            ...m,
            status: row.status,
            home_score: row.home_score,
            away_score: row.away_score,
            next_match_id: row.next_match_id,
            next_match_slot: row.next_match_slot,
            home_team,
            away_team,
            winner_team_id: computeWinner(row),
          }
        })
      )
    }

    const channel = supabase
      .channel(`bracket-${phaseId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `phase_id=eq.${phaseId}`,
        },
        (payload) => applyRow(payload.new as MatchRowPayload)
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseId, teamMap])

  return matches
}
