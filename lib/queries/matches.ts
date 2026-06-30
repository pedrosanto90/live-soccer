import { createClient } from '@/lib/supabase/server'
import { getEffectiveSettings } from '@/lib/utils'
import type { Tier } from '@/lib/tiers'
import type {
  Match,
  MatchEvent,
  MatchStatus,
  PenaltyKick,
  PhaseType,
  Player,
  TournamentSettings,
} from '@/types/database'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface MatchTeamLite {
  id: string
  name: string
  short_name: string | null
  color_primary: string
  color_secondary: string
  tier: Tier
}

export interface MatchPhaseLite {
  id: string
  name: string
  type: PhaseType
}

export interface MatchGroupLite {
  id: string
  name: string
}

export interface MatchRefereeLite {
  id: string
  name: string
}

export interface MatchWithRelations extends Match {
  // Jogos de bracket podem ter slots por preencher ("A definir") até o vencedor
  // do jogo anterior avançar, por isso as equipas são opcionais.
  home_team: MatchTeamLite | null
  away_team: MatchTeamLite | null
  phase: MatchPhaseLite
  group: MatchGroupLite | null
  referee: MatchRefereeLite | null
}

export interface MatchDetail extends MatchWithRelations {
  tournament: { id: string; name: string; settings: TournamentSettings }
  // settings do torneio com o settings_override do jogo aplicado por cima.
  effective_settings: TournamentSettings
}

export interface MatchFilters {
  phase_id?: string
  group_id?: string
  status?: MatchStatus | MatchStatus[]
  // Filtra por escalão (via escalão das equipas). Como ambas as equipas de um
  // jogo são sempre do mesmo escalão, basta filtrar pela equipa da casa.
  tier?: Tier
  // Por defeito os jogos de bracket são excluídos da lista plana (vivem na vista
  // de eliminatórias). A área de admin liga-o para os poder gerir/agendar.
  includeBracket?: boolean
}

// Dois FKs apontam para `teams` (casa/fora), por isso os embeds são
// desambiguados pelo nome da constraint (`matches_<coluna>_fkey`).
const MATCH_SELECT = `
  *,
  home_team:teams!matches_home_team_id_fkey(id, name, short_name, color_primary, color_secondary, tier),
  away_team:teams!matches_away_team_id_fkey(id, name, short_name, color_primary, color_secondary, tier),
  phase:tournament_phases(id, name, type),
  group:groups(id, name),
  referee:referees(id, name)
`

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// Jogos de um torneio com as relações desnormalizadas, ordenados por data
// (sem data no fim) e depois por ordem de criação. O RLS garante o acesso.
export async function getMatchesByTournament(
  tournamentId: string,
  filters?: MatchFilters
): Promise<MatchWithRelations[]> {
  const supabase = await createClient()

  // Filtro por escalão: resolve as equipas do escalão e filtra os jogos pela
  // equipa da casa (ambas as equipas de um jogo são sempre do mesmo escalão).
  let tierTeamIds: string[] | null = null
  if (filters?.tier) {
    const { data: tierTeams } = await supabase
      .from('teams')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('tier', filters.tier)
    tierTeamIds = (tierTeams ?? []).map((t) => t.id)
    if (tierTeamIds.length === 0) return []
  }

  let query = supabase
    .from('matches')
    .select(MATCH_SELECT)
    .eq('tournament_id', tournamentId)

  if (tierTeamIds) query = query.in('home_team_id', tierTeamIds)

  // Por defeito os jogos de bracket vivem na vista de eliminatórias, não na lista
  // plana — e podem ter equipas a null ("A definir"). A área de admin pede-os
  // explicitamente para os poder gerir/agendar.
  if (!filters?.includeBracket) query = query.is('bracket_round', null)

  if (filters?.phase_id) query = query.eq('phase_id', filters.phase_id)
  if (filters?.group_id) query = query.eq('group_id', filters.group_id)
  if (filters?.status) {
    query = Array.isArray(filters.status)
      ? query.in('status', filters.status)
      : query.eq('status', filters.status)
  }

  const { data, error } = await query
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    // Dentro de uma fase de bracket, ordena em árvore (1.ª ronda → final) e por
    // posição. Para jogos sem bracket estes campos são null e não afectam.
    .order('bracket_round', { ascending: false, nullsFirst: true })
    .order('bracket_position', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data as unknown as MatchWithRelations[]
}

// Um jogo por id, com todas as relações e as settings efectivas (merge das
// settings do torneio com o settings_override do jogo).
export async function getMatchById(matchId: string): Promise<MatchDetail | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('matches')
    .select(
      `${MATCH_SELECT}, tournament:tournaments(id, name, settings)`
    )
    .eq('id', matchId)
    .maybeSingle()

  if (!data) return null

  const match = data as unknown as MatchWithRelations & {
    tournament: { id: string; name: string; settings: TournamentSettings }
  }

  return {
    ...match,
    effective_settings: getEffectiveSettings(
      match.tournament.settings,
      match.settings_override
    ),
  }
}

export interface PhaseMatchGroup {
  group: MatchGroupLite | null
  matches: MatchWithRelations[]
}

// Todos os jogos de uma fase, agrupados por grupo (jogos sem grupo no fim).
export async function getMatchesByPhase(
  phaseId: string
): Promise<PhaseMatchGroup[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .eq('phase_id', phaseId)
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error || !data) return []

  const matches = data as unknown as MatchWithRelations[]

  const groups = new Map<string, PhaseMatchGroup>()
  for (const match of matches) {
    const key = match.group?.id ?? '__none__'
    if (!groups.has(key)) {
      groups.set(key, { group: match.group, matches: [] })
    }
    groups.get(key)!.matches.push(match)
  }

  return [...groups.values()]
}

// Árbitros associados a um torneio, ordenados por nome.
export async function getRefereesByTournament(
  tournamentId: string
): Promise<MatchRefereeLite[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('tournament_referees')
    .select('referees(id, name)')
    .eq('tournament_id', tournamentId)

  if (!data) return []

  return (data as unknown as { referees: MatchRefereeLite | null }[])
    .map((r) => r.referees)
    .filter((r): r is MatchRefereeLite => r != null)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
}

export type MatchPlayerLite = Pick<Player, 'id' | 'name' | 'number'>

// Eventos de um jogo, mais recentes primeiro (inclui os cancelados — o cliente
// filtra conforme o contexto).
export async function getMatchEvents(matchId: string): Promise<MatchEvent[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('match_events')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: false })
  return (data as MatchEvent[] | null) ?? []
}

// Pontapés da série de penáltis, pela ordem em que foram marcados.
export async function getMatchPenalties(matchId: string): Promise<PenaltyKick[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('penalty_kicks')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })
  return (data as PenaltyKick[] | null) ?? []
}

// Jogadores activos de uma equipa, ordenados por número (nulls no fim) e nome.
export async function getActivePlayers(teamId: string): Promise<MatchPlayerLite[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('players')
    .select('id, name, number')
    .eq('team_id', teamId)
    .eq('is_active', true)
    .order('number', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })
  return (data as MatchPlayerLite[] | null) ?? []
}
