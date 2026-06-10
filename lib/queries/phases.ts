import { createClient } from '@/lib/supabase/server'
import type { MatchStatus, PhaseType } from '@/types/database'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface GroupTeamLite {
  id: string
  name: string
  short_name: string | null
  color_primary: string
  color_secondary: string
}

export interface GroupWithTeams {
  id: string
  phase_id: string
  name: string
  order_index: number
  teams: GroupTeamLite[]
}

export interface PhaseWithGroups {
  id: string
  tournament_id: string
  name: string
  type: PhaseType
  order_index: number
  created_at: string
  groups: GroupWithTeams[]
  matches_count: number
  // Verdadeiro enquanto nenhum jogo da fase tiver saído de 'scheduled'.
  can_reset: boolean
}

// Forma crua devolvida pelo Supabase para a query aninhada de fases.
interface RawPhaseRow {
  id: string
  tournament_id: string
  name: string
  type: PhaseType
  order_index: number
  created_at: string
  groups: {
    id: string
    phase_id: string
    name: string
    order_index: number
    group_teams: { teams: GroupTeamLite | null }[]
  }[]
  matches: { id: string; status: MatchStatus }[]
}

const PHASE_SELECT = `
  id, tournament_id, name, type, order_index, created_at,
  groups(
    id, phase_id, name, order_index,
    group_teams(teams(id, name, short_name, color_primary, color_secondary))
  ),
  matches(id, status)
`

function mapPhase(row: RawPhaseRow): PhaseWithGroups {
  const groups: GroupWithTeams[] = [...row.groups]
    .sort((a, b) => a.order_index - b.order_index)
    .map((g) => ({
      id: g.id,
      phase_id: g.phase_id,
      name: g.name,
      order_index: g.order_index,
      teams: g.group_teams
        .map((gt) => gt.teams)
        .filter((t): t is GroupTeamLite => t != null),
    }))

  return {
    id: row.id,
    tournament_id: row.tournament_id,
    name: row.name,
    type: row.type,
    order_index: row.order_index,
    created_at: row.created_at,
    groups,
    matches_count: row.matches.length,
    can_reset: row.matches.every((m) => m.status === 'scheduled'),
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// Todas as fases de um torneio, ordenadas por order_index, com os grupos (e as
// suas equipas) e a contagem de jogos. O RLS garante o acesso.
export async function getPhasesByTournament(
  tournamentId: string
): Promise<PhaseWithGroups[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tournament_phases')
    .select(PHASE_SELECT)
    .eq('tournament_id', tournamentId)
    .order('order_index', { ascending: true })

  if (error || !data) return []

  return (data as unknown as RawPhaseRow[]).map(mapPhase)
}

// Uma fase por id, com grupos e equipas detalhadas.
export async function getPhaseById(
  phaseId: string
): Promise<PhaseWithGroups | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('tournament_phases')
    .select(PHASE_SELECT)
    .eq('id', phaseId)
    .maybeSingle()

  if (!data) return null

  return mapPhase(data as unknown as RawPhaseRow)
}

export interface DrawStatus {
  drawn: boolean
  can_reset: boolean
  groups_count: number
  teams_count: number
}

// Estado do sorteio de uma fase: se já foi feito e se pode ser refeito (apenas
// quando nenhum jogo saiu de 'scheduled').
export async function getDrawStatus(phaseId: string): Promise<DrawStatus> {
  const supabase = await createClient()

  const { data: groups } = await supabase
    .from('groups')
    .select('id')
    .eq('phase_id', phaseId)

  const groupIds = (groups ?? []).map((g) => g.id)

  let teamsCount = 0
  if (groupIds.length > 0) {
    const { count } = await supabase
      .from('group_teams')
      .select('team_id', { count: 'exact', head: true })
      .in('group_id', groupIds)
    teamsCount = count ?? 0
  }

  const { data: matches } = await supabase
    .from('matches')
    .select('status')
    .eq('phase_id', phaseId)

  const rows = (matches ?? []) as { status: MatchStatus }[]

  return {
    drawn: groupIds.length > 0 && teamsCount > 0,
    can_reset: rows.every((m) => m.status === 'scheduled'),
    groups_count: groupIds.length,
    teams_count: teamsCount,
  }
}
