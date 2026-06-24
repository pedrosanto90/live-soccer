import { createClient } from '@/lib/supabase/server'
import type {
  MatchEvent,
  MatchStatus,
  PenaltyKick,
  PhaseType,
  PlayerPosition,
} from '@/types/database'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface ReportPlayer {
  id: string
  name: string
  number: number | null
  position: PlayerPosition | null
}

export interface MatchReportData {
  match: {
    id: string
    status: MatchStatus
    home_score: number
    away_score: number
    home_score_extra: number
    away_score_extra: number
    home_penalties: number
    away_penalties: number
    home_fouls_h1: number
    away_fouls_h1: number
    home_fouls_h2: number
    away_fouls_h2: number
    scheduled_at: string | null
    venue: string | null
    tournament_id: string
    finished_at: string | null
  }
  tournament: { name: string }
  phase: { name: string; type: PhaseType }
  group: { name: string } | null
  homeTeam: { id: string; name: string; color_primary: string }
  awayTeam: { id: string; name: string; color_primary: string }
  referee: { name: string } | null
  homePlayers: ReportPlayer[]
  awayPlayers: ReportPlayer[]
  events: MatchEvent[]
  penalties: PenaltyKick[]
}

// Dois FKs apontam para `teams` (casa/fora), por isso os embeds são
// desambiguados pelo nome da constraint (`matches_<coluna>_fkey`).
const REPORT_SELECT = `
  id, status, tournament_id,
  home_team_id, away_team_id,
  home_score, away_score,
  home_score_extra, away_score_extra,
  home_penalties, away_penalties,
  home_fouls_h1, away_fouls_h1,
  home_fouls_h2, away_fouls_h2,
  scheduled_at, venue, finished_at,
  tournament:tournaments(name),
  phase:tournament_phases(name, type),
  group:groups(name),
  home_team:teams!matches_home_team_id_fkey(id, name, color_primary),
  away_team:teams!matches_away_team_id_fkey(id, name, color_primary),
  referee:referees(name)
`

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

// Carrega tudo o que a ficha de jogo precisa numa só passagem: o jogo com as
// relações desnormalizadas, os jogadores de cada equipa (todos, não apenas os
// que tiveram eventos), os eventos não cancelados por ordem cronológica e a
// série de penáltis por ordem de pontapé. O RLS garante o acesso.
export async function getMatchReportData(
  matchId: string
): Promise<MatchReportData | null> {
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('matches')
    .select(REPORT_SELECT)
    .eq('id', matchId)
    .maybeSingle()

  if (!row) return null

  const match = row as unknown as {
    id: string
    status: MatchStatus
    tournament_id: string
    home_team_id: string | null
    away_team_id: string | null
    home_score: number
    away_score: number
    home_score_extra: number
    away_score_extra: number
    home_penalties: number
    away_penalties: number
    home_fouls_h1: number
    away_fouls_h1: number
    home_fouls_h2: number
    away_fouls_h2: number
    scheduled_at: string | null
    venue: string | null
    finished_at: string | null
    tournament: { name: string } | null
    phase: { name: string; type: PhaseType } | null
    group: { name: string } | null
    home_team: { id: string; name: string; color_primary: string } | null
    away_team: { id: string; name: string; color_primary: string } | null
    referee: { name: string } | null
  }

  // A ficha só faz sentido com as duas equipas definidas (jogos de bracket por
  // resolver não têm equipas).
  if (!match.tournament || !match.phase || !match.home_team || !match.away_team) {
    return null
  }

  const [homePlayers, awayPlayers, events, penalties] = await Promise.all([
    getTeamPlayers(supabase, match.home_team.id),
    getTeamPlayers(supabase, match.away_team.id),
    getReportEvents(supabase, matchId),
    getReportPenalties(supabase, matchId),
  ])

  return {
    match: {
      id: match.id,
      status: match.status,
      home_score: match.home_score,
      away_score: match.away_score,
      home_score_extra: match.home_score_extra,
      away_score_extra: match.away_score_extra,
      home_penalties: match.home_penalties,
      away_penalties: match.away_penalties,
      home_fouls_h1: match.home_fouls_h1,
      away_fouls_h1: match.away_fouls_h1,
      home_fouls_h2: match.home_fouls_h2,
      away_fouls_h2: match.away_fouls_h2,
      scheduled_at: match.scheduled_at,
      venue: match.venue,
      tournament_id: match.tournament_id,
      finished_at: match.finished_at,
    },
    tournament: match.tournament,
    phase: match.phase,
    group: match.group,
    homeTeam: match.home_team,
    awayTeam: match.away_team,
    referee: match.referee,
    homePlayers,
    awayPlayers,
    events,
    penalties,
  }
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// Jogadores de uma equipa, ordenados por número (nulls no fim) e nome.
async function getTeamPlayers(
  supabase: SupabaseClient,
  teamId: string
): Promise<ReportPlayer[]> {
  const { data } = await supabase
    .from('players')
    .select('id, name, number, position')
    .eq('team_id', teamId)
    .order('number', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })
  return (data as ReportPlayer[] | null) ?? []
}

// Eventos não cancelados do jogo, por ordem cronológica.
async function getReportEvents(
  supabase: SupabaseClient,
  matchId: string
): Promise<MatchEvent[]> {
  const { data } = await supabase
    .from('match_events')
    .select('*')
    .eq('match_id', matchId)
    .eq('is_cancelled', false)
    .order('elapsed_secs', { ascending: true })
    .order('created_at', { ascending: true })
  return (data as MatchEvent[] | null) ?? []
}

// Pontapés da série de penáltis, pela ordem em que foram marcados.
async function getReportPenalties(
  supabase: SupabaseClient,
  matchId: string
): Promise<PenaltyKick[]> {
  const { data } = await supabase
    .from('penalty_kicks')
    .select('*')
    .eq('match_id', matchId)
    .order('kick_order', { ascending: true })
  return (data as PenaltyKick[] | null) ?? []
}
