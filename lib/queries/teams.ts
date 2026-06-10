import { createClient } from '@/lib/supabase/server'
import type { Team, Player } from '@/types/database'

export interface TeamWithCount extends Team {
  player_count: number
}

export interface TeamWithPlayers extends Team {
  players: Pick<Player, 'id' | 'name' | 'number' | 'position' | 'is_active'>[]
}

export interface TeamStats {
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
}

// Equipas de um torneio com a contagem de jogadores activos, ordenadas por
// nome. O RLS garante o acesso.
export async function getTeamsByTournament(
  tournamentId: string
): Promise<TeamWithCount[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('teams')
    .select('*, players(id, is_active)')
    .eq('tournament_id', tournamentId)
    .order('name', { ascending: true })

  if (error || !data) return []

  return data.map((team) => {
    const { players, ...rest } = team as unknown as Team & {
      players: { id: string; is_active: boolean }[]
    }
    return {
      ...(rest as Team),
      player_count: players.filter((p) => p.is_active).length,
    }
  })
}

// Equipa por id, com os jogadores ordenados por número (nulls no fim) e nome.
export async function getTeamById(
  teamId: string
): Promise<TeamWithPlayers | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('teams')
    .select(
      'id, tournament_id, name, short_name, color_primary, color_secondary, logo_url, created_at, updated_at, players(id, name, number, position, is_active)'
    )
    .eq('id', teamId)
    .order('number', { referencedTable: 'players', ascending: true, nullsFirst: false })
    .order('name', { referencedTable: 'players', ascending: true })
    .maybeSingle()

  return (data as unknown as TeamWithPlayers | null) ?? null
}

// Estatísticas agregadas da equipa no torneio, somadas a partir das standings
// dos grupos a que a equipa pertence (via group_teams → groups → fases).
export async function getTeamStats(
  teamId: string,
  tournamentId: string
): Promise<TeamStats> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('standings')
    .select(
      'played, won, drawn, lost, goals_for, goals_against, groups!inner(tournament_phases!inner(tournament_id))'
    )
    .eq('team_id', teamId)
    .eq('groups.tournament_phases.tournament_id', tournamentId)

  const rows = (data ?? []) as unknown as TeamStats[]

  return rows.reduce<TeamStats>(
    (acc, row) => ({
      played: acc.played + row.played,
      won: acc.won + row.won,
      drawn: acc.drawn + row.drawn,
      lost: acc.lost + row.lost,
      goals_for: acc.goals_for + row.goals_for,
      goals_against: acc.goals_against + row.goals_against,
    }),
    { played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0 }
  )
}
