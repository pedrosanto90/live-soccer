'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import {
  generateBracket,
  computeWinner,
  type BracketSlot,
  type QualifiedTeam,
} from '@/lib/bracket'
import {
  getBracketByPhase,
  getQualifiedTeams,
  type BracketSection,
} from '@/lib/queries/bracket'
import type { ActionResult } from '@/types'
import type { TablesInsert, UserRole } from '@/types/database'

type Supabase = Awaited<ReturnType<typeof createClient>>

const NOT_AUTH = 'Sessão expirada. Inicia sessão novamente.'
const ADMIN_ONLY = 'Não tens permissão para executar esta acção.'
const NOT_KNOCKOUT = 'Esta fase não é de eliminatórias.'
const NOT_FOUND = 'Fase não encontrada.'

// ---------------------------------------------------------------------------
// Autorização
// ---------------------------------------------------------------------------

async function memberRole(
  supabase: Supabase,
  tournamentId: string,
  userId: string
): Promise<UserRole | null> {
  const { data } = await supabase
    .from('tournament_members')
    .select('role')
    .eq('tournament_id', tournamentId)
    .eq('profile_id', userId)
    .maybeSingle()
  return (data?.role as UserRole | undefined) ?? null
}

// ---------------------------------------------------------------------------
// Leitura do estado do bracket (para o painel de admin, carregado on-demand)
// ---------------------------------------------------------------------------

export async function getBracketSection(phaseId: string): Promise<BracketSection> {
  const supabase = await createClient()

  const { data: phase } = await supabase
    .from('tournament_phases')
    .select('tournament_id, type')
    .eq('id', phaseId)
    .maybeSingle()

  if (!phase || phase.type !== 'knockout') {
    return { generated: false, matches: [], qualified: [] }
  }

  const matches = await getBracketByPhase(phaseId)
  if (matches.length > 0) {
    return { generated: true, matches, qualified: [] }
  }

  const qualified = await getQualifiedTeams(phase.tournament_id)
  return { generated: false, matches: [], qualified }
}

// ---------------------------------------------------------------------------
// Geração do bracket
// ---------------------------------------------------------------------------

export async function generateKnockoutBracket(
  phaseId: string
): Promise<ActionResult<{ matches_created: number }>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: NOT_AUTH }

  const { data: phase } = await supabase
    .from('tournament_phases')
    .select('id, tournament_id, type')
    .eq('id', phaseId)
    .maybeSingle()
  if (!phase) return { success: false, error: NOT_FOUND }
  if (phase.type !== 'knockout') return { success: false, error: NOT_KNOCKOUT }

  const role = await memberRole(supabase, phase.tournament_id, user.id)
  if (role !== 'admin') return { success: false, error: ADMIN_ONLY }

  // Não regerar por cima de um bracket existente. Conta só jogos de bracket
  // (bracket_round preenchido) — jogos manuais criados na fase não contam, para
  // não bloquear a geração nem divergir da vista (que também os ignora).
  const { count } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('phase_id', phaseId)
    .not('bracket_round', 'is', null)
  if ((count ?? 0) > 0) {
    return { success: false, error: 'O bracket desta fase já foi gerado.' }
  }

  const teams = await getQualifiedTeams(phase.tournament_id)
  if (teams.length < 2) {
    return {
      success: false,
      error: 'São necessárias pelo menos 2 equipas apuradas para gerar o bracket.',
    }
  }

  const rounds = generateBracket(teams)
  const slots = rounds.flatMap((r) => r.slots)

  // Um id por slot, para podermos ligar `next_match_id` antes do insert.
  const idByKey = new Map<string, string>()
  const key = (round: number, position: number) => `${round}:${position}`
  for (const slot of slots) idByKey.set(key(slot.round, slot.position), crypto.randomUUID())

  const nextIdFor = (slot: BracketSlot): string | null => {
    if (slot.next_match_position == null) return null
    return idByKey.get(key(slot.round / 2, slot.next_match_position)) ?? null
  }

  const rows: TablesInsert<'matches'>[] = slots.map((slot) => ({
    id: idByKey.get(key(slot.round, slot.position))!,
    tournament_id: phase.tournament_id,
    phase_id: phaseId,
    group_id: null,
    status: 'scheduled',
    home_team_id: slot.home_team?.team_id ?? null,
    away_team_id: slot.away_team?.team_id ?? null,
    bracket_round: slot.round,
    bracket_position: slot.position,
    next_match_id: nextIdFor(slot),
    next_match_slot: slot.next_match_slot,
  }))

  // Byes: a equipa presente avança já para o jogo seguinte.
  for (const slot of slots) {
    if (!slot.is_bye) continue
    const winner = slot.home_team ?? slot.away_team
    const nextId = nextIdFor(slot)
    if (!winner || !nextId || !slot.next_match_slot) continue
    const target = rows.find((r) => r.id === nextId)
    if (!target) continue
    if (slot.next_match_slot === 'home') target.home_team_id = winner.team_id
    else target.away_team_id = winner.team_id
  }

  const { error } = await supabase.from('matches').insert(rows)
  if (error) {
    return { success: false, error: 'Não foi possível gerar o bracket.' }
  }

  revalidatePath(`/tournaments/${phase.tournament_id}/phases`)
  return { success: true, data: { matches_created: rows.length } }
}

// ---------------------------------------------------------------------------
// Avanço automático do vencedor
// ---------------------------------------------------------------------------

// Chamada após terminar um jogo de eliminatórias. Coloca o vencedor no slot
// correcto do jogo seguinte. Sem jogo seguinte (final) → nada a fazer.
export async function advanceWinner(matchId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: NOT_AUTH }

  const { data: match } = await supabase
    .from('matches')
    .select(
      'tournament_id, status, home_team_id, away_team_id, home_score, away_score, home_score_extra, away_score_extra, home_penalties, away_penalties, next_match_id, next_match_slot'
    )
    .eq('id', matchId)
    .maybeSingle()
  if (!match) return { success: false, error: 'Jogo não encontrado.' }

  const role = await memberRole(supabase, match.tournament_id as string, user.id)
  if (role !== 'admin' && role !== 'operator') {
    return { success: false, error: ADMIN_ONLY }
  }

  if (!match.next_match_id || !match.next_match_slot) {
    return { success: true, data: undefined } // final ou jogo terminal
  }

  const winner = computeWinner({
    status: match.status,
    home_team_id: match.home_team_id,
    away_team_id: match.away_team_id,
    home_score: match.home_score,
    away_score: match.away_score,
    home_score_extra: match.home_score_extra,
    away_score_extra: match.away_score_extra,
    home_penalties: match.home_penalties,
    away_penalties: match.away_penalties,
  })
  if (!winner) return { success: true, data: undefined }

  const patch =
    match.next_match_slot === 'home'
      ? { home_team_id: winner }
      : { away_team_id: winner }

  const { error } = await supabase
    .from('matches')
    .update(patch)
    .eq('id', match.next_match_id)
  if (error) {
    return { success: false, error: 'Não foi possível avançar o vencedor.' }
  }

  revalidatePath(`/tournaments/${match.tournament_id}/phases`)
  return { success: true, data: undefined }
}

// ---------------------------------------------------------------------------
// Refazer o bracket
// ---------------------------------------------------------------------------

export async function resetKnockoutBracket(
  phaseId: string
): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: NOT_AUTH }

  const { data: phase } = await supabase
    .from('tournament_phases')
    .select('id, tournament_id, type')
    .eq('id', phaseId)
    .maybeSingle()
  if (!phase) return { success: false, error: NOT_FOUND }
  if (phase.type !== 'knockout') return { success: false, error: NOT_KNOCKOUT }

  const role = await memberRole(supabase, phase.tournament_id, user.id)
  if (role !== 'admin') return { success: false, error: ADMIN_ONLY }

  // Só permitido enquanto nenhum jogo de bracket tiver saído de 'scheduled'.
  const { count } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('phase_id', phaseId)
    .not('bracket_round', 'is', null)
    .neq('status', 'scheduled')
  if ((count ?? 0) > 0) {
    return {
      success: false,
      error: 'Não é possível refazer: já há jogos iniciados nesta fase.',
    }
  }

  // Apaga só os jogos de bracket — jogos manuais da fase são preservados.
  const { error } = await supabase
    .from('matches')
    .delete()
    .eq('phase_id', phaseId)
    .not('bracket_round', 'is', null)
  if (error) {
    return { success: false, error: 'Não foi possível refazer o bracket.' }
  }

  revalidatePath(`/tournaments/${phase.tournament_id}/phases`)
  return { success: true, data: undefined }
}
