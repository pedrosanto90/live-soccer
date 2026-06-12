import { createClient } from '@/lib/supabase/server'
import type { MatchStatus, Tournament, TournamentStatus } from '@/types/database'

const LIVE_STATUSES: MatchStatus[] = [
  'in_progress',
  'half_time',
  'extra_time',
  'penalties',
]

// Filtros aplicáveis à listagem pública de torneios (home page).
export interface PublicTournamentFilters {
  search?: string // pesquisa por nome (ilike, case-insensitive)
  status?: TournamentStatus | TournamentStatus[]
  starts_after?: string // data ISO
  starts_before?: string // data ISO
}

// Torneio público com contagens agregadas para os cards da home.
export interface PublicTournament extends Tournament {
  teams_count: number
  matches_count: number
  has_live_match: boolean
}

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

// Torneios públicos para a home page, com contagens de equipas e jogos e um
// indicador de jogo ao vivo. Aplica os filtros opcionais (nome, estado, datas).
// Ordenação: activos primeiro, depois por starts_at desc.
export async function getPublicTournaments(
  filters: PublicTournamentFilters = {}
): Promise<PublicTournament[]> {
  const supabase = await createClient()

  let query = supabase
    .from('tournaments')
    .select('*, teams(count), matches(status)')
    .eq('visibility', 'public')

  if (filters.search) {
    query = query.ilike('name', `%${filters.search}%`)
  }
  if (filters.status) {
    query = Array.isArray(filters.status)
      ? query.in('status', filters.status)
      : query.eq('status', filters.status)
  }
  if (filters.starts_after) {
    query = query.gte('starts_at', filters.starts_after)
  }
  if (filters.starts_before) {
    query = query.lte('starts_at', filters.starts_before)
  }

  const { data, error } = await query.order('starts_at', {
    ascending: false,
    nullsFirst: false,
  })

  if (error || !data) return []

  type Row = Tournament & {
    teams: { count: number }[] | null
    matches: { status: MatchStatus }[] | null
  }

  const tournaments: PublicTournament[] = (data as unknown as Row[]).map(
    ({ teams, matches, ...tournament }) => {
      const matchRows = matches ?? []
      return {
        ...tournament,
        teams_count: teams?.[0]?.count ?? 0,
        matches_count: matchRows.length,
        has_live_match: matchRows.some((m) => LIVE_STATUSES.includes(m.status)),
      }
    }
  )

  // sort estável: mantém a ordem por starts_at desc dentro de cada grupo.
  return tournaments.sort(
    (a, b) =>
      (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1)
  )
}
