import { createClient } from '@/lib/supabase/server'
import type { StandingRow } from '@/lib/standings'
import type { PhaseType } from '@/types/database'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface StandingsPhaseLite {
  id: string
  name: string
  type: PhaseType
  order_index: number
}

export interface StandingsGroupLite {
  id: string
  name: string
  order_index: number
}

export interface GroupStandings {
  group: StandingsGroupLite
  standings: StandingRow[]
}

export interface PhaseStandings {
  phase: StandingsPhaseLite
  groups: GroupStandings[]
}

// Embed das colunas da equipa necessárias para o display.
const TEAM_SELECT = 'id, name, short_name, color_primary, color_secondary, logo_url'

// Forma crua devolvida pelo Supabase para a query aninhada.
interface RawStanding extends Omit<StandingRow, 'team'> {
  team: StandingRow['team'] | null
}

interface RawGroup {
  id: string
  name: string
  order_index: number
  standings: RawStanding[]
}

interface RawPhase {
  id: string
  name: string
  type: PhaseType
  order_index: number
  groups: RawGroup[]
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// Todas as standings de um torneio, agrupadas por fase e grupo, com os dados
// completos da equipa. A ordenação base é por pontos desc — a ordenação final
// (com os critérios de desempate do torneio) é feita no cliente com
// `sortStandings`. Só inclui fases de grupos. O RLS garante o acesso.
export async function getStandingsByTournament(
  tournamentId: string
): Promise<PhaseStandings[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tournament_phases')
    .select(
      `
      id, name, type, order_index,
      groups(
        id, name, order_index,
        standings(*, team:teams(${TEAM_SELECT}))
      )
    `
    )
    .eq('tournament_id', tournamentId)
    .eq('type', 'group')
    .order('order_index', { ascending: true })

  if (error || !data) return []

  return (data as unknown as RawPhase[]).map((phase) => ({
    phase: {
      id: phase.id,
      name: phase.name,
      type: phase.type,
      order_index: phase.order_index,
    },
    groups: [...phase.groups]
      .sort((a, b) => a.order_index - b.order_index)
      .map((group) => ({
        group: { id: group.id, name: group.name, order_index: group.order_index },
        standings: group.standings
          .filter((s): s is RawStanding & { team: StandingRow['team'] } => s.team != null)
          .map((s) => ({ ...s, team: s.team })),
      })),
  }))
}

// Standings de um grupo específico, com os dados da equipa. Ordenação base por
// pontos desc (a ordenação final é feita no cliente).
export async function getStandingsByGroup(groupId: string): Promise<StandingRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('standings')
    .select(`*, team:teams(${TEAM_SELECT})`)
    .eq('group_id', groupId)
    .order('points', { ascending: false })

  if (error || !data) return []

  return (data as unknown as RawStanding[])
    .filter((s): s is RawStanding & { team: StandingRow['team'] } => s.team != null)
    .map((s) => ({ ...s, team: s.team }))
}
