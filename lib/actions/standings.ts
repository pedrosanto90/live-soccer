'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/types'
import type { TournamentSettings } from '@/types/database'

type Supabase = Awaited<ReturnType<typeof createClient>>

interface FinishedMatch {
  id: string
  home_team_id: string
  away_team_id: string
  home_score: number
  away_score: number
  home_score_extra: number
  away_score_extra: number
}

interface Row {
  group_id: string
  team_id: string
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  points: number
  yellow_cards: number
  red_cards: number
  updated_at: string
}

function emptyRow(groupId: string, teamId: string): Row {
  return {
    group_id: groupId,
    team_id: teamId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goals_for: 0,
    goals_against: 0,
    points: 0,
    yellow_cards: 0,
    red_cards: 0,
    updated_at: new Date().toISOString(),
  }
}

// Recalcula a classificação de um grupo a partir de todos os jogos terminados.
// Recomputar (em vez de incrementar) torna a operação idempotente: anular um
// golo e voltar a terminar o jogo não duplica pontos.
//
// Chamada internamente por `finishMatch`. Só actua em jogos de fase de grupos
// (o jogo tem de ter `group_id`). Os penáltis não contam para a classificação —
// apenas golos normais + prolongamento.
export async function updateStandings(matchId: string): Promise<ActionResult> {
  const supabase: Supabase = await createClient()

  const { data: match } = await supabase
    .from('matches')
    .select('group_id, tournament_id')
    .eq('id', matchId)
    .maybeSingle()

  if (!match) return { success: false, error: 'Jogo não encontrado.' }
  if (!match.group_id) return { success: true, data: undefined }

  const groupId = match.group_id as string

  // Configurações de pontuação do torneio.
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('settings')
    .eq('id', match.tournament_id)
    .maybeSingle()

  const scoring = (tournament?.settings as TournamentSettings | undefined)?.scoring ?? {
    points_win: 3,
    points_draw: 1,
    points_loss: 0,
  }

  // Equipas do grupo (incluindo as que ainda não jogaram).
  const { data: groupTeams } = await supabase
    .from('group_teams')
    .select('team_id')
    .eq('group_id', groupId)

  const rows = new Map<string, Row>()
  for (const gt of (groupTeams ?? []) as { team_id: string }[]) {
    rows.set(gt.team_id, emptyRow(groupId, gt.team_id))
  }
  const ensure = (teamId: string) => {
    if (!rows.has(teamId)) rows.set(teamId, emptyRow(groupId, teamId))
    return rows.get(teamId)!
  }

  // Jogos terminados do grupo.
  const { data: matches } = await supabase
    .from('matches')
    .select(
      'id, home_team_id, away_team_id, home_score, away_score, home_score_extra, away_score_extra'
    )
    .eq('group_id', groupId)
    .eq('status', 'finished')

  const finished = (matches ?? []) as FinishedMatch[]

  for (const m of finished) {
    const home = ensure(m.home_team_id)
    const away = ensure(m.away_team_id)

    const homeGoals = m.home_score + (m.home_score_extra ?? 0)
    const awayGoals = m.away_score + (m.away_score_extra ?? 0)

    home.played += 1
    away.played += 1
    home.goals_for += homeGoals
    home.goals_against += awayGoals
    away.goals_for += awayGoals
    away.goals_against += homeGoals

    if (homeGoals > awayGoals) {
      home.won += 1
      home.points += scoring.points_win
      away.lost += 1
      away.points += scoring.points_loss
    } else if (awayGoals > homeGoals) {
      away.won += 1
      away.points += scoring.points_win
      home.lost += 1
      home.points += scoring.points_loss
    } else {
      home.drawn += 1
      away.drawn += 1
      home.points += scoring.points_draw
      away.points += scoring.points_draw
    }
  }

  // Cartões (de todos os jogos terminados do grupo).
  if (finished.length > 0) {
    const { data: cards } = await supabase
      .from('match_events')
      .select('team_id, event_type')
      .in(
        'match_id',
        finished.map((m) => m.id)
      )
      .in('event_type', ['yellow_card', 'red_card'])
      .eq('is_cancelled', false)

    for (const c of (cards ?? []) as {
      team_id: string
      event_type: string
    }[]) {
      const row = ensure(c.team_id)
      if (c.event_type === 'yellow_card') row.yellow_cards += 1
      else if (c.event_type === 'red_card') row.red_cards += 1
    }
  }

  const { error } = await supabase
    .from('standings')
    .upsert([...rows.values()], { onConflict: 'group_id,team_id' })

  if (error) {
    return { success: false, error: 'Não foi possível actualizar a classificação.' }
  }

  return { success: true, data: undefined }
}
