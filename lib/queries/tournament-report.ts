import { createClient } from '@/lib/supabase/server'
import {
  computeWinner,
  getRoundLabel,
  isThirdPlaceMatch,
  THIRD_PLACE_LABEL,
} from '@/lib/bracket'
import { sortStandings, type StandingRow } from '@/lib/standings'
import { getStandingsByTournament } from '@/lib/queries/standings'
import type {
  EventType,
  PhaseType,
  TournamentSettings,
  TournamentStatus,
} from '@/types/database'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface TournamentReportData {
  tournament: {
    id: string
    name: string
    description: string | null
    status: TournamentStatus
    starts_at: string | null
    ends_at: string | null
    venue: string | null // não há coluna no torneio — usa o venue dos jogos
    settings: TournamentSettings
  }
  organizer: {
    name: string
  }
  phases: PhaseReport[]
  finalStandings: FinalStanding[]
  topScorers: TopScorer[]
  disciplineTable: DisciplineRow[]
  collectiveStats: CollectiveStats
}

export interface PhaseReport {
  id: string
  name: string
  type: PhaseType
  order_index: number
  groups: GroupReport[] // só para type === 'group'
  knockoutRounds: KnockoutRound[] // só para type === 'knockout'
}

export interface GroupReport {
  id: string
  name: string
  standings: StandingRow[] // ordenadas com sortStandings
  matches: MatchResult[] // todos os jogos terminados do grupo
}

export interface KnockoutRound {
  round: number // bracket_round
  label: string // "Final", "Meia-final", etc.
  matches: MatchResult[]
}

export interface MatchResult {
  id: string
  scheduled_at: string | null
  home_team_name: string
  away_team_name: string
  home_score: number
  away_score: number
  home_score_extra: number
  away_score_extra: number
  home_penalties: number
  away_penalties: number
  status: string
}

export interface FinalStanding {
  position: number
  team_name: string
  points: number
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
}

export interface TopScorer {
  player_name: string
  team_name: string
  goals: number
}

export interface DisciplineRow {
  player_name: string
  team_name: string
  yellow_cards: number
  red_cards: number
}

export interface CollectiveStats {
  most_goals_team: { name: string; goals: number }
  least_conceded_team: { name: string; goals: number }
  best_fair_play_team: { name: string; cards: number }
  total_goals: number
  total_matches: number
  avg_goals_per_match: number
}

// ---------------------------------------------------------------------------
// Formas cruas devolvidas pelo Supabase
// ---------------------------------------------------------------------------

const TEAM_NAME_SELECT = 'id, name'

interface RawReportMatch {
  id: string
  phase_id: string
  group_id: string | null
  bracket_round: number | null
  bracket_position: number | null
  scheduled_at: string | null
  venue: string | null
  status: string
  home_team_id: string | null
  away_team_id: string | null
  home_score: number
  away_score: number
  home_score_extra: number
  away_score_extra: number
  home_penalties: number
  away_penalties: number
  home_team: { id: string; name: string } | null
  away_team: { id: string; name: string } | null
}

interface RawEvent {
  team_id: string
  player_name: string | null
  event_type: EventType
}

// ---------------------------------------------------------------------------
// Query principal
// ---------------------------------------------------------------------------

// Carrega tudo o que a ficha de torneio precisa: o torneio com o organizador, as
// fases (grupos com classificação e jogos; eliminatórias por ronda), a
// classificação final, goleadores, disciplina e estatísticas colectivas. O RLS
// garante o acesso. Devolve `null` se o torneio não existir.
export async function getTournamentReportData(
  tournamentId: string
): Promise<TournamentReportData | null> {
  const supabase = await createClient()

  // Torneio + organizador (criador).
  const { data: tournamentRow } = await supabase
    .from('tournaments')
    .select(
      `id, name, description, status, starts_at, ends_at, settings,
       created_by_profile:profiles!tournaments_created_by_fkey(name)`
    )
    .eq('id', tournamentId)
    .maybeSingle()

  if (!tournamentRow) return null

  const tournament = tournamentRow as unknown as {
    id: string
    name: string
    description: string | null
    status: TournamentStatus
    starts_at: string | null
    ends_at: string | null
    settings: TournamentSettings
    created_by_profile: { name: string } | null
  }

  const tiebreak = tournament.settings?.tiebreak_order ?? [
    'points',
    'goal_difference',
    'goals_scored',
  ]
  const scoring = tournament.settings?.scoring ?? {
    points_win: 3,
    points_draw: 1,
    points_loss: 0,
  }

  // Fases ordenadas.
  const { data: phaseRows } = await supabase
    .from('tournament_phases')
    .select('id, name, type, order_index')
    .eq('tournament_id', tournamentId)
    .order('order_index', { ascending: true })

  const phases = (phaseRows as
    | { id: string; name: string; type: PhaseType; order_index: number }[]
    | null) ?? []

  // Todos os jogos terminados, com nomes das equipas.
  const { data: matchRows } = await supabase
    .from('matches')
    .select(
      `id, phase_id, group_id, bracket_round, bracket_position,
       scheduled_at, venue, status,
       home_team_id, away_team_id,
       home_score, away_score, home_score_extra, away_score_extra,
       home_penalties, away_penalties,
       home_team:teams!matches_home_team_id_fkey(${TEAM_NAME_SELECT}),
       away_team:teams!matches_away_team_id_fkey(${TEAM_NAME_SELECT})`
    )
    .eq('tournament_id', tournamentId)
    .eq('status', 'finished')

  const finishedMatches = (matchRows as unknown as RawReportMatch[] | null) ?? []

  // Eventos não cancelados dos jogos terminados (golos e cartões).
  const matchIds = finishedMatches.map((m) => m.id)
  let events: RawEvent[] = []
  if (matchIds.length > 0) {
    const { data: eventRows } = await supabase
      .from('match_events')
      .select('team_id, player_name, event_type')
      .in('match_id', matchIds)
      .eq('is_cancelled', false)
    events = (eventRows as RawEvent[] | null) ?? []
  }

  // Mapa id -> nome de equipa (cobre equipas sem jogos terminados também).
  const { data: teamRows } = await supabase
    .from('teams')
    .select('id, name')
    .eq('tournament_id', tournamentId)
  const teamNames = new Map<string, string>(
    ((teamRows as { id: string; name: string }[] | null) ?? []).map((t) => [
      t.id,
      t.name,
    ])
  )

  // Classificação por grupo (já com os dados completos da equipa).
  const standingsByTournament = await getStandingsByTournament(tournamentId)
  const groupStandings = new Map<string, StandingRow[]>()
  for (const phase of standingsByTournament) {
    for (const { group, standings } of phase.groups) {
      groupStandings.set(group.id, sortStandings(standings, tiebreak))
    }
  }

  // ── Relatórios por fase ──────────────────────────────────────────────────
  const phaseReports: PhaseReport[] = phases.map((phase) => {
    const phaseMatches = finishedMatches.filter((m) => m.phase_id === phase.id)

    if (phase.type === 'group') {
      // Grupos desta fase, ordenados, com classificação e jogos.
      const phaseGroups = standingsByTournament.find(
        (p) => p.phase.id === phase.id
      )?.groups ?? []

      const groups: GroupReport[] = phaseGroups.map(({ group }) => ({
        id: group.id,
        name: group.name,
        standings: groupStandings.get(group.id) ?? [],
        matches: phaseMatches
          .filter((m) => m.group_id === group.id)
          .map(toMatchResult)
          .sort(byScheduledAt),
      }))

      return {
        id: phase.id,
        name: phase.name,
        type: phase.type,
        order_index: phase.order_index,
        groups,
        knockoutRounds: [],
      }
    }

    // Eliminatórias: jogos agrupados por bracket_round. O jogo de 3.º/4.º lugar
    // sai numa "ronda" própria (sentinela 0), para não se misturar com a final.
    const roundsMap = new Map<number, MatchResult[]>()
    const thirdPlaceMatches: MatchResult[] = []
    for (const m of phaseMatches) {
      if (m.bracket_round == null) continue
      if (isThirdPlaceMatch(m.bracket_round, m.bracket_position)) {
        thirdPlaceMatches.push(toMatchResult(m))
        continue
      }
      const list = roundsMap.get(m.bracket_round) ?? []
      list.push(toMatchResult(m))
      roundsMap.set(m.bracket_round, list)
    }
    const knockoutRounds: KnockoutRound[] = [...roundsMap.entries()].map(
      ([round, matches]) => ({
        round,
        label: getRoundLabel(round),
        matches: matches.sort(byScheduledAt),
      })
    )
    if (thirdPlaceMatches.length > 0) {
      knockoutRounds.push({
        round: 0,
        label: THIRD_PLACE_LABEL,
        matches: thirdPlaceMatches,
      })
    }

    return {
      id: phase.id,
      name: phase.name,
      type: phase.type,
      order_index: phase.order_index,
      groups: [],
      knockoutRounds,
    }
  })

  // ── Agregados por equipa (a partir de todos os jogos terminados) ──────────
  interface TeamAgg {
    name: string
    played: number
    won: number
    drawn: number
    lost: number
    goals_for: number
    goals_against: number
    points: number
    cards: number
  }
  const agg = new Map<string, TeamAgg>()
  const ensure = (id: string): TeamAgg => {
    let a = agg.get(id)
    if (!a) {
      a = {
        name: teamNames.get(id) ?? '—',
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goals_for: 0,
        goals_against: 0,
        points: 0,
        cards: 0,
      }
      agg.set(id, a)
    }
    return a
  }

  let totalGoals = 0
  for (const m of finishedMatches) {
    if (!m.home_team_id || !m.away_team_id) continue
    const homeGoals = m.home_score + m.home_score_extra
    const awayGoals = m.away_score + m.away_score_extra
    totalGoals += homeGoals + awayGoals

    const home = ensure(m.home_team_id)
    const away = ensure(m.away_team_id)
    home.played++
    away.played++
    home.goals_for += homeGoals
    home.goals_against += awayGoals
    away.goals_for += awayGoals
    away.goals_against += homeGoals

    if (homeGoals > awayGoals) {
      home.won++
      away.lost++
      home.points += scoring.points_win
      away.points += scoring.points_loss
    } else if (awayGoals > homeGoals) {
      away.won++
      home.lost++
      away.points += scoring.points_win
      home.points += scoring.points_loss
    } else {
      home.drawn++
      away.drawn++
      home.points += scoring.points_draw
      away.points += scoring.points_draw
    }
  }

  // Cartões por equipa (para o fair play).
  for (const e of events) {
    if (e.event_type === 'yellow_card' || e.event_type === 'red_card') {
      ensure(e.team_id).cards++
    }
  }

  // ── Classificação final ───────────────────────────────────────────────────
  // Ordenação base agregada: pontos, depois diferença de golos, depois golos.
  const aggOrdered = [...agg.entries()]
    .map(([id, a]) => ({ id, ...a, goal_difference: a.goals_for - a.goals_against }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goal_difference - a.goal_difference ||
        b.goals_for - a.goals_for
    )

  // Vencedor + perdedor de um jogo de eliminatória terminado (ou null se ainda
  // não estiver decidido). Usado para o pódio a partir da final e do 3.º lugar.
  const decideMatch = (
    m: RawReportMatch | undefined
  ): [string, string] | null => {
    if (!m || !m.home_team_id || !m.away_team_id) return null
    const winner = computeWinner({
      status: 'finished',
      home_team_id: m.home_team_id,
      away_team_id: m.away_team_id,
      home_score: m.home_score,
      away_score: m.away_score,
      home_score_extra: m.home_score_extra,
      away_score_extra: m.away_score_extra,
      home_penalties: m.home_penalties,
      away_penalties: m.away_penalties,
    })
    if (!winner) return null
    const loser = winner === m.home_team_id ? m.away_team_id : m.home_team_id
    return [winner, loser]
  }

  // Pódio: 1.º/2.º a partir da final (round 1, posição 0); 3.º/4.º a partir do
  // jogo de atribuição do 3.º lugar, quando existe e terminou.
  const finalMatch = finishedMatches.find(
    (m) => m.bracket_round === 1 && m.bracket_position === 0
  )
  const thirdPlaceMatch = finishedMatches.find((m) =>
    isThirdPlaceMatch(m.bracket_round, m.bracket_position)
  )
  let podiumOrder: string[] = []
  const finalResult = decideMatch(finalMatch)
  if (finalResult) {
    podiumOrder = [...finalResult]
    const thirdResult = decideMatch(thirdPlaceMatch)
    if (thirdResult) podiumOrder.push(...thirdResult)
  }

  // Combina o pódio (se houver final) com o resto ordenado pelos agregados.
  const orderedIds = [
    ...podiumOrder,
    ...aggOrdered.map((a) => a.id).filter((id) => !podiumOrder.includes(id)),
  ]
  const aggById = new Map(aggOrdered.map((a) => [a.id, a]))
  const finalStandings: FinalStanding[] = orderedIds
    .map((id) => aggById.get(id))
    .filter((a): a is NonNullable<typeof a> => a != null)
    .map((a, i) => ({
      position: i + 1,
      team_name: a.name,
      points: a.points,
      played: a.played,
      won: a.won,
      drawn: a.drawn,
      lost: a.lost,
      goals_for: a.goals_for,
      goals_against: a.goals_against,
      goal_difference: a.goal_difference,
    }))

  // ── Goleadores ────────────────────────────────────────────────────────────
  // Golos creditados ao jogador: golo de jogo + penálti convertido durante o
  // jogo (ambos contam para o marcador). Os autogolos não creditam o jogador e
  // os penáltis do desempate (penalty_kicks) não entram. Top 10.
  const scorerMap = new Map<string, TopScorer>()
  for (const e of events) {
    const isGoal = e.event_type === 'goal' || e.event_type === 'penalty_scored'
    if (!isGoal || !e.player_name) continue
    const key = `${e.team_id}::${e.player_name}`
    const existing = scorerMap.get(key)
    if (existing) {
      existing.goals++
    } else {
      scorerMap.set(key, {
        player_name: e.player_name,
        team_name: teamNames.get(e.team_id) ?? '—',
        goals: 1,
      })
    }
  }
  const topScorers = [...scorerMap.values()]
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 10)

  // ── Disciplina ──────────────────────────────────────────────────────────
  const disciplineMap = new Map<string, DisciplineRow>()
  for (const e of events) {
    if (e.event_type !== 'yellow_card' && e.event_type !== 'red_card') continue
    if (!e.player_name) continue
    const key = `${e.team_id}::${e.player_name}`
    const row =
      disciplineMap.get(key) ??
      {
        player_name: e.player_name,
        team_name: teamNames.get(e.team_id) ?? '—',
        yellow_cards: 0,
        red_cards: 0,
      }
    if (e.event_type === 'yellow_card') row.yellow_cards++
    else row.red_cards++
    disciplineMap.set(key, row)
  }
  const disciplineTable = [...disciplineMap.values()].sort(
    (a, b) =>
      b.red_cards - a.red_cards ||
      b.yellow_cards - a.yellow_cards ||
      a.player_name.localeCompare(b.player_name)
  )

  // ── Estatísticas colectivas ───────────────────────────────────────────────
  const totalMatches = finishedMatches.length
  const teamsWithGames = aggOrdered.filter((a) => a.played > 0)

  const mostGoals = teamsWithGames.reduce<{ name: string; goals: number }>(
    (best, a) => (a.goals_for > best.goals ? { name: a.name, goals: a.goals_for } : best),
    { name: '—', goals: 0 }
  )
  const leastConceded =
    teamsWithGames.length > 0
      ? teamsWithGames.reduce((best, a) =>
          a.goals_against < best.goals_against ? a : best
        )
      : null
  const bestFairPlay =
    teamsWithGames.length > 0
      ? teamsWithGames.reduce((best, a) => (a.cards < best.cards ? a : best))
      : null

  const collectiveStats: CollectiveStats = {
    most_goals_team: mostGoals,
    least_conceded_team: leastConceded
      ? { name: leastConceded.name, goals: leastConceded.goals_against }
      : { name: '—', goals: 0 },
    best_fair_play_team: bestFairPlay
      ? { name: bestFairPlay.name, cards: bestFairPlay.cards }
      : { name: '—', cards: 0 },
    total_goals: totalGoals,
    total_matches: totalMatches,
    avg_goals_per_match: totalMatches > 0 ? totalGoals / totalMatches : 0,
  }

  // Venue: primeira instalação definida nos jogos.
  const venue = finishedMatches.find((m) => m.venue)?.venue ?? null

  return {
    tournament: {
      id: tournament.id,
      name: tournament.name,
      description: tournament.description,
      status: tournament.status,
      starts_at: tournament.starts_at,
      ends_at: tournament.ends_at,
      venue,
      settings: tournament.settings,
    },
    organizer: { name: tournament.created_by_profile?.name ?? '—' },
    phases: phaseReports,
    finalStandings,
    topScorers,
    disciplineTable,
    collectiveStats,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toMatchResult(m: RawReportMatch): MatchResult {
  return {
    id: m.id,
    scheduled_at: m.scheduled_at,
    home_team_name: m.home_team?.name ?? '—',
    away_team_name: m.away_team?.name ?? '—',
    home_score: m.home_score,
    away_score: m.away_score,
    home_score_extra: m.home_score_extra,
    away_score_extra: m.away_score_extra,
    home_penalties: m.home_penalties,
    away_penalties: m.away_penalties,
    status: m.status,
  }
}

function byScheduledAt(a: MatchResult, b: MatchResult): number {
  return (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? '')
}
