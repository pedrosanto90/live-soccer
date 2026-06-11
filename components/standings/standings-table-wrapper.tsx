'use client'

import { useMemo } from 'react'

import { useStandingsRealtime } from '@/hooks/use-standings-realtime'
import type { StandingRow } from '@/lib/standings'
import { StandingsTable } from '@/components/standings/standings-table'
import type { TiebreakerCriterion } from '@/types/database'

interface StandingsTableWrapperProps {
  groupId: string
  initialStandings: StandingRow[]
  tiebreakOrder: TiebreakerCriterion[]
  qualifyingSpots?: number
  highlightTeamId?: string
  compact?: boolean
}

// Recebe as standings iniciais do Server Component e activa o Realtime para as
// manter actualizadas em tempo real.
export function StandingsTableWrapper({
  groupId,
  initialStandings,
  tiebreakOrder,
  qualifyingSpots,
  highlightTeamId,
  compact,
}: StandingsTableWrapperProps) {
  const initial = useMemo(
    () => ({ [groupId]: initialStandings }),
    [groupId, initialStandings]
  )
  const groupIds = useMemo(() => [groupId], [groupId])

  const standings = useStandingsRealtime(initial, groupIds)

  return (
    <StandingsTable
      standings={standings[groupId] ?? initialStandings}
      tiebreakOrder={tiebreakOrder}
      qualifyingSpots={qualifyingSpots}
      highlightTeamId={highlightTeamId}
      compact={compact}
    />
  )
}
