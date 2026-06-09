import { createClient } from '@/lib/supabase/server'
import type { Tournament } from '@/types/database'

export interface TournamentStats {
  teams: number
  matches: number
  active_matches: number
  finished_matches: number
}

export interface TournamentWithStats extends Tournament {
  stats: TournamentStats
}

// Conta jogos/equipas de um torneio para os stat cards do overview e dos cards.
export async function getTournamentStats(id: string): Promise<TournamentStats> {
  const supabase = await createClient()

  const [teams, matches, active, finished] = await Promise.all([
    supabase
      .from('teams')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', id),
    supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', id),
    supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', id)
      .in('status', ['in_progress', 'half_time', 'extra_time', 'penalties']),
    supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', id)
      .eq('status', 'finished'),
  ])

  return {
    teams: teams.count ?? 0,
    matches: matches.count ?? 0,
    active_matches: active.count ?? 0,
    finished_matches: finished.count ?? 0,
  }
}

// Torneios onde o utilizador é membro, com stats, ordenados por criação desc.
export async function getTournamentsByUser(
  userId: string
): Promise<TournamentWithStats[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tournaments')
    .select('*, tournament_members!inner(profile_id)')
    .eq('tournament_members.profile_id', userId)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  const tournaments = data as unknown as Tournament[]

  return Promise.all(
    tournaments.map(async (t) => ({
      ...t,
      stats: await getTournamentStats(t.id),
    }))
  )
}

// Torneio por id, para páginas de admin. O RLS garante o acesso — devolve
// null se o utilizador não tiver permissão ou o torneio não existir.
export async function getTournamentById(
  id: string
): Promise<Tournament | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  return data ?? null
}

// Torneio por slug, para páginas públicas. Inclui o perfil do criador,
// as fases e os grupos.
export async function getTournamentBySlug(slug: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from('tournaments')
    .select(
      `*,
       created_by_profile:profiles!tournaments_created_by_fkey(id, name, avatar_url),
       tournament_phases(*, groups(*))`
    )
    .eq('slug', slug)
    .maybeSingle()

  return data ?? null
}
