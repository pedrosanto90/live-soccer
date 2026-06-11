import { createClient } from '@/lib/supabase/server'
import { computeWinner, type QualifiedTeam } from '@/lib/bracket'
import { sortStandings } from '@/lib/standings'
import { getStandingsByTournament } from '@/lib/queries/standings'
import type { MatchStatus, TournamentSettings } from '@/types/database'

// Quantos classificados de cada grupo se apuram para as eliminatórias. O
// formato standard de futsal apura os 2 primeiros — alinhado com o display da
// classificação (`QUALIFYING_SPOTS`).
export const DEFAULT_QUALIFYING_SPOTS = 2

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface BracketTeamLite {
  id: string
  name: string
  short_name: string | null
  color_primary: string
  color_secondary: string
}

export interface BracketMatchRow {
  id: string
  bracket_round: number
  bracket_position: number
  next_match_id: string | null
  next_match_slot: 'home' | 'away' | null
  home_team: BracketTeamLite | null
  away_team: BracketTeamLite | null
  home_score: number
  away_score: number
  status: MatchStatus
  winner_team_id: string | null
}

const TEAM_SELECT = 'id, name, short_name, color_primary, color_secondary'

// Forma crua devolvida pelo Supabase para a query do bracket.
interface RawBracketMatch {
  id: string
  bracket_round: number | null
  bracket_position: number | null
  next_match_id: string | null
  next_match_slot: 'home' | 'away' | null
  home_team_id: string | null
  away_team_id: string | null
  home_team: BracketTeamLite | null
  away_team: BracketTeamLite | null
  status: MatchStatus
  home_score: number
  away_score: number
  home_score_extra: number
  away_score_extra: number
  home_penalties: number
  away_penalties: number
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// Todos os jogos de eliminatórias de uma fase, ordenados do maior round para o
// menor (quartos → meias → final) e por posição. Inclui as equipas (que podem
// ser null para slots ainda por preencher) e o vencedor calculado. O RLS
// garante o acesso.
export async function getBracketByPhase(
  phaseId: string
): Promise<BracketMatchRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('matches')
    .select(
      `
      id, bracket_round, bracket_position, next_match_id, next_match_slot,
      home_team_id, away_team_id, status,
      home_score, away_score, home_score_extra, away_score_extra,
      home_penalties, away_penalties,
      home_team:teams!matches_home_team_id_fkey(${TEAM_SELECT}),
      away_team:teams!matches_away_team_id_fkey(${TEAM_SELECT})
    `
    )
    .eq('phase_id', phaseId)
    .not('bracket_round', 'is', null)
    .order('bracket_round', { ascending: false })
    .order('bracket_position', { ascending: true })

  if (error || !data) return []

  return (data as unknown as RawBracketMatch[]).map((m) => ({
    id: m.id,
    bracket_round: m.bracket_round ?? 0,
    bracket_position: m.bracket_position ?? 0,
    next_match_id: m.next_match_id,
    next_match_slot: m.next_match_slot,
    home_team: m.home_team,
    away_team: m.away_team,
    home_score: m.home_score,
    away_score: m.away_score,
    status: m.status,
    winner_team_id: computeWinner(m),
  }))
}

export interface BracketSection {
  generated: boolean
  matches: BracketMatchRow[]
  qualified: QualifiedTeam[]
}

export interface KnockoutPhaseBracket {
  id: string
  name: string
  matches: BracketMatchRow[]
}

// Fases de eliminatórias de um torneio que já têm bracket gerado, com os
// respectivos jogos. Usado na página pública para a tab "Bracket".
export async function getKnockoutBrackets(
  tournamentId: string
): Promise<KnockoutPhaseBracket[]> {
  const supabase = await createClient()

  const { data: phases } = await supabase
    .from('tournament_phases')
    .select('id, name')
    .eq('tournament_id', tournamentId)
    .eq('type', 'knockout')
    .order('order_index', { ascending: true })

  if (!phases || phases.length === 0) return []

  const brackets = await Promise.all(
    (phases as { id: string; name: string }[]).map(async (p) => ({
      id: p.id,
      name: p.name,
      matches: await getBracketByPhase(p.id),
    }))
  )

  return brackets.filter((b) => b.matches.length > 0)
}

// Equipas apuradas de todos os grupos do torneio: os primeiros `spots` de cada
// grupo, ordenados pelos critérios de desempate do torneio. Devolvidas por
// ordem de grupo e depois de posição — a ordem que `generateBracket` espera.
export async function getQualifiedTeams(
  tournamentId: string,
  spots: number = DEFAULT_QUALIFYING_SPOTS
): Promise<QualifiedTeam[]> {
  const supabase = await createClient()

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('settings')
    .eq('id', tournamentId)
    .maybeSingle()

  const tiebreak =
    (tournament?.settings as TournamentSettings | undefined)?.tiebreak_order ?? [
      'points',
      'goal_difference',
      'goals_scored',
    ]

  const phases = await getStandingsByTournament(tournamentId)

  const qualified: QualifiedTeam[] = []
  for (const phase of phases) {
    for (const { group, standings } of phase.groups) {
      const sorted = sortStandings(standings, tiebreak)
      sorted.slice(0, spots).forEach((row, i) => {
        qualified.push({
          team_id: row.team_id,
          team_name: row.team.name,
          team_short_name: row.team.short_name,
          color_primary: row.team.color_primary,
          color_secondary: row.team.color_secondary,
          from_group: group.name,
          position: i + 1,
        })
      })
    }
  }

  return qualified
}
