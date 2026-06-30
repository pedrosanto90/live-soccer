import type { TeamTier, TiebreakerCriterion } from '@/types/database'

export interface StandingTeam {
  id: string
  name: string
  short_name: string | null
  color_primary: string
  color_secondary: string
  logo_url: string | null
  tier: TeamTier
}

export interface StandingRow {
  id: string
  team_id: string
  team: StandingTeam
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
  yellow_cards: number
  red_cards: number
}

// Ordena as standings de um grupo pelos critérios de desempate do torneio.
// Aplica os critérios sequencialmente — só passa ao seguinte se houver empate.
// Função pura: não consulta a BD e não muta o array recebido.
export function sortStandings(
  standings: StandingRow[],
  tiebreakOrder: TiebreakerCriterion[]
): StandingRow[] {
  return [...standings].sort((a, b) => {
    for (const criterion of tiebreakOrder) {
      const diff = compareByCriterion(a, b, criterion)
      if (diff !== 0) return diff
    }
    return 0
  })
}

function compareByCriterion(
  a: StandingRow,
  b: StandingRow,
  criterion: TiebreakerCriterion
): number {
  switch (criterion) {
    case 'points':
      return b.points - a.points
    case 'goal_difference':
      return b.goal_difference - a.goal_difference
    case 'goals_scored':
      return b.goals_for - a.goals_for
    case 'goals_conceded':
      return a.goals_against - b.goals_against // menor é melhor
    case 'yellow_cards':
      return a.yellow_cards - b.yellow_cards // menor é melhor
    case 'red_cards':
      return a.red_cards - b.red_cards // menor é melhor
    case 'head_to_head':
      // head_to_head requer os resultados dos confrontos directos — tratado
      // como empate por agora.
      return 0
    case 'draw':
      return 0
    default:
      return 0
  }
}
