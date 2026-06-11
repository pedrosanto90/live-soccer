'use client'

import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { StandingRow } from '@/lib/standings'

// Mapa groupId → standings desse grupo.
export type StandingsByGroup = Record<string, StandingRow[]>

// Subscreve à tabela `standings` via Supabase Realtime e mantém o estado local
// sincronizado. O Realtime só entrega as colunas da row (sem o embed da equipa),
// por isso fundimos as estatísticas recebidas na row existente, preservando os
// dados da equipa carregados no servidor.
export function useStandingsRealtime(
  initialStandings: StandingsByGroup,
  groupIds: string[]
): StandingsByGroup {
  const [standings, setStandings] = useState<StandingsByGroup>(initialStandings)

  // Re-hidrata quando o servidor envia novas standings iniciais (ex.: após um
  // router.refresh). Ajuste de estado em render — o padrão recomendado do React
  // para reagir a uma mudança de prop sem um efeito.
  const [prevInitial, setPrevInitial] = useState(initialStandings)
  if (prevInitial !== initialStandings) {
    setPrevInitial(initialStandings)
    setStandings(initialStandings)
  }

  const groupKey = groupIds.join(',')

  useEffect(() => {
    if (groupIds.length === 0) return

    const supabase = createClient()

    // Garante que o socket usa o token da sessão antes de subscrever, para que
    // as alterações filtradas por RLS sejam entregues.
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) supabase.realtime.setAuth(data.session.access_token)
    })

    const wanted = new Set(groupIds)

    function applyRow(row: Partial<StandingRow> & { group_id?: string; team_id?: string }) {
      const groupId = row.group_id
      if (!groupId || !wanted.has(groupId)) return

      setStandings((prev) => {
        const current = prev[groupId] ?? []
        const next = current.map((s) =>
          s.team_id === row.team_id ? { ...s, ...row, team: s.team } : s
        )
        return { ...prev, [groupId]: next }
      })
    }

    const channel = supabase
      .channel(`standings-${groupKey}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'standings' },
        (payload) => applyRow(payload.new as StandingRow)
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'standings' },
        (payload) => applyRow(payload.new as StandingRow)
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey])

  return standings
}
