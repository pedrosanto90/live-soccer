'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import {
  generateBracket,
  computeWinner,
  THIRD_PLACE_POSITION,
  type BracketSlot,
} from '@/lib/bracket'
import {
  getBracketByPhase,
  getQualifiedTeams,
  type BracketSection,
} from '@/lib/queries/bracket'
import {
  buildMatchSlots,
  matchDurationMinutes,
  MATCH_GAP_MINUTES,
} from '@/lib/scheduling'
import { TIER_ORDER, type Tier } from '@/lib/tiers'
import type { ActionResult } from '@/types'
import type {
  TablesInsert,
  TournamentSettings,
  UserRole,
} from '@/types/database'

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
    .select('id, tournament_id, type, tier')
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

  // Eliminatórias por escalão: só apura equipas do escalão da fase. `tier` null
  // (fase mono-escalão) apura todas as equipas, como antes.
  const teams = await getQualifiedTeams(
    phase.tournament_id,
    undefined,
    phase.tier ?? undefined
  )
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

  // Agendamento automático: distribui horários pelos jogos efectivamente
  // jogados (ignora byes), por ordem de ronda. Continua a seguir aos jogos já
  // agendados do torneio (tipicamente a fase de grupos) para não os sobrepor.
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('settings')
    .eq('id', phase.tournament_id)
    .maybeSingle()
  const settings = (tournament?.settings ?? null) as Partial<TournamentSettings> | null
  // Offset = nº de jogos já agendados, excluindo as finais. As finais são
  // agendadas à parte (no fim do torneio, por `finals_order`) por
  // `rescheduleFinals`, por isso não contam para o offset dos jogos inline.
  const offset = await countScheduledNonFinals(supabase, phase.tournament_id)

  // Jogo de 3.º/4.º lugar: opcional, e só quando existem duas meias-finais
  // reais (ronda 2, sem byes) de onde saem os dois perdedores que o disputam.
  // Com 3 equipas uma das meias é um bye e não produz perdedor — nesse caso não
  // se cria o jogo.
  const semis = rounds.find((r) => r.round === 2)
  const wantsThirdPlace =
    settings?.match?.third_place_match === true &&
    semis != null &&
    semis.slots.length === 2 &&
    semis.slots.every((s) => !s.is_bye)
  const thirdPlaceId = wantsThirdPlace ? crypto.randomUUID() : null
  const thirdPlaceKey = key(1, THIRD_PLACE_POSITION)

  // Chaves dos jogos efectivamente jogados, por ordem de agendamento. A final
  // (ronda 1, posição 0) é EXCLUÍDA — fica sem hora aqui e é agendada no fim, por
  // ordem de escalão, por `rescheduleFinals`. O jogo de 3.º lugar é acrescentado
  // a seguir aos restantes jogos desta fase.
  const finalKey = key(1, 0)
  const playableKeys = slots
    .filter((s) => !s.is_bye)
    .map((s) => key(s.round, s.position))
    .filter((k) => k !== finalKey)
  if (thirdPlaceId) {
    playableKeys.push(thirdPlaceKey)
  }
  const timeline = buildMatchSlots(
    settings?.daily_schedule ?? [],
    matchDurationMinutes(settings?.match),
    MATCH_GAP_MINUTES,
    offset + playableKeys.length
  )
  const scheduledAtByKey = new Map<string, string>()
  playableKeys.forEach((k, i) => {
    const at = timeline[offset + i]
    if (at) scheduledAtByKey.set(k, at)
  })

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
    scheduled_at: scheduledAtByKey.get(key(slot.round, slot.position)) ?? null,
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

  // Jogo de 3.º/4.º lugar: jogo terminal sem equipas definidas — os perdedores
  // das meias-finais são colocados pelo `advanceWinner` quando cada meia termina.
  if (thirdPlaceId) {
    rows.push({
      id: thirdPlaceId,
      tournament_id: phase.tournament_id,
      phase_id: phaseId,
      group_id: null,
      status: 'scheduled',
      home_team_id: null,
      away_team_id: null,
      bracket_round: 1,
      bracket_position: THIRD_PLACE_POSITION,
      next_match_id: null,
      next_match_slot: null,
      scheduled_at: scheduledAtByKey.get(thirdPlaceKey) ?? null,
    })
  }

  const { error } = await supabase.from('matches').insert(rows)
  if (error) {
    return { success: false, error: 'Não foi possível gerar o bracket.' }
  }

  // Reagenda todas as finais do torneio para o fim, por `finals_order`.
  await rescheduleFinals(supabase, phase.tournament_id)

  revalidatePath(`/tournaments/${phase.tournament_id}/phases`)
  return { success: true, data: { matches_created: rows.length } }
}

// ---------------------------------------------------------------------------
// Agendamento das finais (fim do torneio, por ordem de escalão)
// ---------------------------------------------------------------------------

// Uma final é o jogo terminal do bracket: ronda 1, posição 0. (O jogo de 3.º
// lugar vive na ronda 1 mas na posição reservada `THIRD_PLACE_POSITION`.)
const FINAL_ROUND = 1
const FINAL_POSITION = 0

// Conta os jogos já agendados do torneio, excluindo as finais — base estável
// para o agendamento, já que as finais são empurradas sempre para o fim.
async function countScheduledNonFinals(
  supabase: Supabase,
  tournamentId: string
): Promise<number> {
  const { count: total } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .not('scheduled_at', 'is', null)

  const { count: finals } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .not('scheduled_at', 'is', null)
    .eq('bracket_round', FINAL_ROUND)
    .eq('bracket_position', FINAL_POSITION)

  return (total ?? 0) - (finals ?? 0)
}

interface FinalRow {
  id: string
  tier: Tier | null
}

// Coloca todas as finais das fases knockout do torneio no fim do calendário, por
// `finals_order` (escalões fora da lista, ou sem escalão, vão para o fim por
// TIER_ORDER). Idempotente: cada geração recoloca todas as finais na cauda.
async function rescheduleFinals(
  supabase: Supabase,
  tournamentId: string
): Promise<void> {
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('settings, finals_order')
    .eq('id', tournamentId)
    .maybeSingle()
  const settings = (tournament?.settings ?? null) as Partial<TournamentSettings> | null
  const finalsOrder = (tournament?.finals_order ?? []) as Tier[]

  const { data: finalsData } = await supabase
    .from('matches')
    .select('id, phase:tournament_phases!matches_phase_id_fkey(tier)')
    .eq('tournament_id', tournamentId)
    .eq('bracket_round', FINAL_ROUND)
    .eq('bracket_position', FINAL_POSITION)

  const finals: FinalRow[] = (
    (finalsData ?? []) as unknown as {
      id: string
      phase: { tier: Tier | null } | null
    }[]
  ).map((m) => ({ id: m.id, tier: m.phase?.tier ?? null }))
  if (finals.length === 0) return

  // Ordena por `finals_order`; escalões em falta (ou sem tier) ficam no fim,
  // estáveis por TIER_ORDER.
  const rank = (tier: Tier | null): number => {
    if (!tier) return Number.MAX_SAFE_INTEGER
    const i = finalsOrder.indexOf(tier)
    return i >= 0 ? i : finalsOrder.length + TIER_ORDER[tier]
  }
  finals.sort((a, b) => rank(a.tier) - rank(b.tier))

  const base = await countScheduledNonFinals(supabase, tournamentId)
  const timeline = buildMatchSlots(
    settings?.daily_schedule ?? [],
    matchDurationMinutes(settings?.match),
    MATCH_GAP_MINUTES,
    base + finals.length
  )

  await Promise.all(
    finals.map((f, i) =>
      supabase
        .from('matches')
        .update({ scheduled_at: timeline[base + i] ?? null })
        .eq('id', f.id)
    )
  )
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
      'tournament_id, phase_id, status, home_team_id, away_team_id, home_score, away_score, home_score_extra, away_score_extra, home_penalties, away_penalties, bracket_round, bracket_position, next_match_id, next_match_slot'
    )
    .eq('id', matchId)
    .maybeSingle()
  if (!match) return { success: false, error: 'Jogo não encontrado.' }

  const role = await memberRole(supabase, match.tournament_id as string, user.id)
  if (role !== 'admin' && role !== 'operator') {
    return { success: false, error: ADMIN_ONLY }
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
  if (!winner) return { success: true, data: undefined } // ainda por decidir

  // Vencedor → slot do jogo seguinte (a final, para as meias). Sem jogo
  // seguinte (final ou jogo de 3.º lugar) não há nada a propagar.
  if (match.next_match_id && match.next_match_slot) {
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
  }

  // Meias-finais (ronda 2): o perdedor desce ao jogo de 3.º/4.º lugar, se
  // existir. A meia da posição 0 ocupa o lado da casa; a da posição 1, o de fora.
  if (match.bracket_round === 2) {
    const loser =
      winner === match.home_team_id ? match.away_team_id : match.home_team_id
    const { data: thirdPlace } = await supabase
      .from('matches')
      .select('id')
      .eq('phase_id', match.phase_id as string)
      .eq('bracket_round', 1)
      .eq('bracket_position', THIRD_PLACE_POSITION)
      .maybeSingle()
    if (thirdPlace && loser) {
      const loserPatch =
        match.bracket_position === 0
          ? { home_team_id: loser }
          : { away_team_id: loser }
      const { error } = await supabase
        .from('matches')
        .update(loserPatch)
        .eq('id', thirdPlace.id)
      if (error) {
        return { success: false, error: 'Não foi possível avançar o perdedor.' }
      }
    }
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

  // Recompacta as finais restantes para o fim, por `finals_order`.
  await rescheduleFinals(supabase, phase.tournament_id)

  revalidatePath(`/tournaments/${phase.tournament_id}/phases`)
  return { success: true, data: undefined }
}
