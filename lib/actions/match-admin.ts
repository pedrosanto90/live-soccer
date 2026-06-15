'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { foulsColumn } from '@/lib/utils'
import { updateStandings } from '@/lib/actions/standings'
import { advanceWinner } from '@/lib/actions/bracket'
import type { ActionResult } from '@/types'
import type {
  EventType,
  Match,
  MatchEvent,
  PenaltyKick,
  UserRole,
} from '@/types/database'

type Supabase = Awaited<ReturnType<typeof createClient>>

const NOT_AUTH = 'Sessão expirada. Inicia sessão novamente.'
const STAFF_ONLY = 'Não tens permissão para executar esta acção.'
const NOT_FOUND = 'Jogo não encontrado.'

// ---------------------------------------------------------------------------
// Tipos de entrada
// ---------------------------------------------------------------------------

export interface AddEventInput {
  team_id: string
  player_id?: string | null
  player_name?: string | null
  event_type: EventType
  elapsed_secs: number
}

export interface AddFoulInput {
  team_id: string
  player_id?: string | null
  player_name?: string | null
  // Cartão associado à falta (null = sem cartão).
  card?: 'yellow_card' | 'red_card' | null
  elapsed_secs: number
}

export interface PenaltyKickInput {
  team_id: string
  player_id?: string | null
  player_name?: string | null
  scored: boolean
}

// ---------------------------------------------------------------------------
// Helpers de autorização
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

// Carrega o jogo completo e exige que o utilizador seja admin/operator.
async function requireMatchStaff(
  supabase: Supabase,
  matchId: string
): Promise<{ match: Match; userId: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: NOT_AUTH }

  const { data: match } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .maybeSingle()
  if (!match) return { error: NOT_FOUND }

  const role = await memberRole(supabase, (match as Match).tournament_id, user.id)
  if (role !== 'admin' && role !== 'operator') return { error: STAFF_ONLY }

  return { match: match as Match, userId: user.id }
}

function revalidateMatch(match: Match) {
  revalidatePath(`/tournaments/${match.tournament_id}/matches/${match.id}`)
}

// Aplica uma actualização à linha do jogo e devolve a versão actualizada.
async function patchMatch(
  supabase: Supabase,
  matchId: string,
  patch: Partial<Match>
): Promise<ActionResult<Match>> {
  const { data, error } = await supabase
    .from('matches')
    .update(patch)
    .eq('id', matchId)
    .select('*')
    .single()

  if (error || !data) {
    return { success: false, error: 'Não foi possível actualizar o jogo.' }
  }
  return { success: true, data: data as Match }
}

// Segundos decorridos na parte actual, a partir dos campos persistidos.
function computeElapsed(match: Match): number {
  if (!match.timer_started_at) return match.timer_elapsed_secs ?? 0
  const startedAt = new Date(match.timer_started_at).getTime() / 1000
  return (match.timer_elapsed_secs ?? 0) + (Date.now() / 1000 - startedAt)
}

// ---------------------------------------------------------------------------
// Ciclo de vida da partida
// ---------------------------------------------------------------------------

export async function startMatch(matchId: string): Promise<ActionResult<Match>> {
  const supabase = await createClient()
  const auth = await requireMatchStaff(supabase, matchId)
  if ('error' in auth) return { success: false, error: auth.error }

  if (auth.match.status !== 'scheduled') {
    return { success: false, error: 'O jogo já foi iniciado.' }
  }

  const now = new Date().toISOString()
  const result = await patchMatch(supabase, matchId, {
    status: 'in_progress',
    current_period: 'first_half',
    started_at: now,
    timer_started_at: now,
    timer_elapsed_secs: 0,
  })
  if (result.success) revalidateMatch(result.data)
  return result
}

export async function pauseTimer(matchId: string): Promise<ActionResult<Match>> {
  const supabase = await createClient()
  const auth = await requireMatchStaff(supabase, matchId)
  if ('error' in auth) return { success: false, error: auth.error }

  if (!auth.match.timer_started_at) {
    return { success: true, data: auth.match } // já estava em pausa
  }

  return patchMatch(supabase, matchId, {
    timer_elapsed_secs: Math.round(computeElapsed(auth.match)),
    timer_started_at: null,
  })
}

export async function resumeTimer(matchId: string): Promise<ActionResult<Match>> {
  const supabase = await createClient()
  const auth = await requireMatchStaff(supabase, matchId)
  if ('error' in auth) return { success: false, error: auth.error }

  if (auth.match.timer_started_at) {
    return { success: true, data: auth.match } // já estava a correr
  }

  return patchMatch(supabase, matchId, {
    timer_started_at: new Date().toISOString(),
  })
}

export async function resetTimer(matchId: string): Promise<ActionResult<Match>> {
  const supabase = await createClient()
  const auth = await requireMatchStaff(supabase, matchId)
  if ('error' in auth) return { success: false, error: auth.error }

  if (auth.match.timer_started_at) {
    return { success: false, error: 'Pausa o cronómetro antes de o reiniciar.' }
  }

  return patchMatch(supabase, matchId, { timer_elapsed_secs: 0 })
}

export async function setTimerManual(
  matchId: string,
  minutes: number,
  seconds: number
): Promise<ActionResult<Match>> {
  const supabase = await createClient()
  const auth = await requireMatchStaff(supabase, matchId)
  if ('error' in auth) return { success: false, error: auth.error }

  if (auth.match.timer_started_at) {
    return { success: false, error: 'Pausa o cronómetro antes de o ajustar.' }
  }

  const total = Math.max(0, Math.floor(minutes) * 60 + Math.floor(seconds))
  return patchMatch(supabase, matchId, { timer_elapsed_secs: total })
}

// Sincronização silenciosa do cronómetro (a cada 30s pelo useTimer). Só
// persiste quando o timer está a correr; não devolve nada.
export async function syncTimer(
  matchId: string,
  elapsedSecs: number
): Promise<void> {
  const supabase = await createClient()
  const auth = await requireMatchStaff(supabase, matchId)
  if ('error' in auth) return

  if (!auth.match.timer_started_at) return

  await supabase
    .from('matches')
    .update({
      timer_elapsed_secs: Math.max(0, Math.round(elapsedSecs)),
      timer_started_at: new Date().toISOString(),
    })
    .eq('id', matchId)
}

export async function endHalf(matchId: string): Promise<ActionResult<Match>> {
  const supabase = await createClient()
  const auth = await requireMatchStaff(supabase, matchId)
  if ('error' in auth) return { success: false, error: auth.error }

  const elapsed = Math.round(computeElapsed(auth.match))
  const patch: Partial<Match> = {
    timer_elapsed_secs: elapsed,
    timer_started_at: null,
  }

  // A 1.ª parte termina em intervalo; as restantes pausam no estado actual à
  // espera da próxima acção (iniciar 2.ª parte, terminar jogo, etc.).
  if (auth.match.current_period === 'first_half') {
    patch.status = 'half_time'
  }

  const result = await patchMatch(supabase, matchId, patch)
  if (result.success) revalidateMatch(result.data)
  return result
}

export async function startSecondHalf(
  matchId: string
): Promise<ActionResult<Match>> {
  const supabase = await createClient()
  const auth = await requireMatchStaff(supabase, matchId)
  if ('error' in auth) return { success: false, error: auth.error }

  const result = await patchMatch(supabase, matchId, {
    status: 'in_progress',
    current_period: 'second_half',
    timer_elapsed_secs: 0,
    timer_started_at: new Date().toISOString(),
  })
  if (result.success) revalidateMatch(result.data)
  return result
}

export async function startExtraTime(
  matchId: string
): Promise<ActionResult<Match>> {
  const supabase = await createClient()
  const auth = await requireMatchStaff(supabase, matchId)
  if ('error' in auth) return { success: false, error: auth.error }

  const result = await patchMatch(supabase, matchId, {
    status: 'extra_time',
    current_period: 'extra_first',
    timer_elapsed_secs: 0,
    timer_started_at: new Date().toISOString(),
  })
  if (result.success) revalidateMatch(result.data)
  return result
}

export async function startSecondExtraHalf(
  matchId: string
): Promise<ActionResult<Match>> {
  const supabase = await createClient()
  const auth = await requireMatchStaff(supabase, matchId)
  if ('error' in auth) return { success: false, error: auth.error }

  const result = await patchMatch(supabase, matchId, {
    current_period: 'extra_second',
    timer_elapsed_secs: 0,
    timer_started_at: new Date().toISOString(),
  })
  if (result.success) revalidateMatch(result.data)
  return result
}

export async function finishMatch(
  matchId: string,
  outcome: 'finish' | 'extra_time' | 'penalties'
): Promise<ActionResult<Match>> {
  if (outcome === 'extra_time') return startExtraTime(matchId)

  const supabase = await createClient()
  const auth = await requireMatchStaff(supabase, matchId)
  if ('error' in auth) return { success: false, error: auth.error }

  if (outcome === 'penalties') {
    const result = await patchMatch(supabase, matchId, {
      status: 'penalties',
      current_period: 'penalties',
      timer_started_at: null,
      timer_elapsed_secs: Math.round(computeElapsed(auth.match)),
    })
    if (result.success) revalidateMatch(result.data)
    return result
  }

  // outcome === 'finish'
  const result = await patchMatch(supabase, matchId, {
    status: 'finished',
    finished_at: new Date().toISOString(),
    timer_started_at: null,
    timer_elapsed_secs: Math.round(computeElapsed(auth.match)),
  })
  if (!result.success) return result

  await updateStandings(matchId)

  // Jogo de eliminatórias: propaga o vencedor para o jogo seguinte do bracket.
  if (result.data.bracket_round != null) {
    await advanceWinner(matchId)
  }

  revalidateMatch(result.data)
  revalidatePath(`/tournaments/${result.data.tournament_id}/matches`)
  return result
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

export async function addEvent(
  matchId: string,
  event: AddEventInput
): Promise<ActionResult<{ event: MatchEvent; match: Match }>> {
  const supabase = await createClient()
  const auth = await requireMatchStaff(supabase, matchId)
  if ('error' in auth) return { success: false, error: auth.error }

  const match = auth.match
  if (!match.current_period) {
    return { success: false, error: 'O jogo não está em curso.' }
  }

  const side: 'home' | 'away' =
    event.team_id === match.home_team_id ? 'home' : 'away'

  const { data: created, error } = await supabase
    .from('match_events')
    .insert({
      match_id: matchId,
      team_id: event.team_id,
      player_id: event.player_id ?? null,
      player_name: event.player_name?.trim() || null,
      event_type: event.event_type,
      period: match.current_period,
      elapsed_secs: Math.max(0, Math.round(event.elapsed_secs)),
      created_by: auth.userId,
    })
    .select('*')
    .single()

  if (error || !created) {
    return { success: false, error: 'Não foi possível registar o evento.' }
  }

  // Actualiza os contadores agregados conforme o tipo de evento. Devolvemos o
  // jogo já com o patch aplicado para o painel reflectir de imediato, sem
  // depender do eco do Realtime.
  const patch = scorePatchForEvent(match, event.event_type, side, +1)
  if (patch) await supabase.from('matches').update(patch).eq('id', matchId)

  return {
    success: true,
    data: { event: created as MatchEvent, match: { ...match, ...(patch ?? {}) } },
  }
}

// Regista uma falta e, opcionalmente, o cartão associado. A falta é sempre
// guardada (necessária para estatísticas futuras) mas não aparece no log de
// eventos; só o cartão, quando existe, é mostrado. Ambos partilham jogador,
// equipa e minuto.
export async function addFoul(
  matchId: string,
  input: AddFoulInput
): Promise<ActionResult<{ foul: MatchEvent; card: MatchEvent | null; match: Match }>> {
  const supabase = await createClient()
  const auth = await requireMatchStaff(supabase, matchId)
  if ('error' in auth) return { success: false, error: auth.error }

  const match = auth.match
  if (!match.current_period) {
    return { success: false, error: 'O jogo não está em curso.' }
  }

  const side: 'home' | 'away' =
    input.team_id === match.home_team_id ? 'home' : 'away'
  const elapsedSecs = Math.max(0, Math.round(input.elapsed_secs))
  const playerId = input.player_id ?? null
  const playerName = input.player_name?.trim() || null

  const base = {
    match_id: matchId,
    team_id: input.team_id,
    player_id: playerId,
    player_name: playerName,
    period: match.current_period,
    elapsed_secs: elapsedSecs,
    created_by: auth.userId,
  }

  const { data: foul, error: foulError } = await supabase
    .from('match_events')
    .insert({ ...base, event_type: 'foul' })
    .select('*')
    .single()

  if (foulError || !foul) {
    return { success: false, error: 'Não foi possível registar a falta.' }
  }

  // Incrementa o contador de faltas da parte actual.
  const patch = scorePatchForEvent(match, 'foul', side, +1)
  if (patch) await supabase.from('matches').update(patch).eq('id', matchId)

  let card: MatchEvent | null = null
  if (input.card) {
    const { data: createdCard, error: cardError } = await supabase
      .from('match_events')
      .insert({ ...base, event_type: input.card })
      .select('*')
      .single()
    if (cardError || !createdCard) {
      // A falta já ficou registada; o cartão falhou. Reportamos para o operador
      // poder voltar a tentar adicionar o cartão pelo log.
      return { success: false, error: 'Falta registada, mas o cartão falhou.' }
    }
    card = createdCard as MatchEvent
  }

  return {
    success: true,
    data: {
      foul: foul as MatchEvent,
      card,
      match: { ...match, ...(patch ?? {}) },
    },
  }
}

export interface UpdateEventInput {
  player_id?: string | null
  player_name?: string | null
  elapsed_secs?: number
}

// Edita os dados descritivos de um evento já registado (jogador, minuto) — por
// exemplo, atribuir o autor de um golo só mais tarde. Não altera tipo nem
// equipa, por isso não mexe nos contadores agregados (marcador/faltas).
export async function updateEvent(
  eventId: string,
  input: UpdateEventInput
): Promise<ActionResult<{ event: MatchEvent }>> {
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('match_events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle()
  if (!event) return { success: false, error: 'Evento não encontrado.' }

  const auth = await requireMatchStaff(supabase, (event as MatchEvent).match_id)
  if ('error' in auth) return { success: false, error: auth.error }

  const patch: Partial<MatchEvent> = {}
  if ('player_id' in input) patch.player_id = input.player_id ?? null
  if ('player_name' in input) patch.player_name = input.player_name?.trim() || null
  if (input.elapsed_secs != null) {
    patch.elapsed_secs = Math.max(0, Math.round(input.elapsed_secs))
  }

  const { data: updated, error } = await supabase
    .from('match_events')
    .update(patch)
    .eq('id', eventId)
    .select('*')
    .single()

  if (error || !updated) {
    return { success: false, error: 'Não foi possível editar o evento.' }
  }

  return { success: true, data: { event: updated as MatchEvent } }
}

export async function cancelEvent(
  eventId: string
): Promise<ActionResult<{ match: Match }>> {
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('match_events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle()
  if (!event) return { success: false, error: 'Evento não encontrado.' }

  const ev = event as MatchEvent
  const auth = await requireMatchStaff(supabase, ev.match_id)
  if ('error' in auth) return { success: false, error: auth.error }

  if (ev.is_cancelled) return { success: true, data: { match: auth.match } } // idempotente

  const { error } = await supabase
    .from('match_events')
    .update({ is_cancelled: true, cancelled_at: new Date().toISOString() })
    .eq('id', eventId)
  if (error) {
    return { success: false, error: 'Não foi possível anular o evento.' }
  }

  // Reverte o contador agregado correspondente (nunca abaixo de 0). O período
  // guardado no evento garante que a falta certa é decrementada, mesmo que a
  // parte actual já tenha mudado.
  const side: 'home' | 'away' =
    ev.team_id === auth.match.home_team_id ? 'home' : 'away'
  const patch = scorePatchForEvent(auth.match, ev.event_type, side, -1, ev.period)
  if (patch) await supabase.from('matches').update(patch).eq('id', ev.match_id)

  return { success: true, data: { match: { ...auth.match, ...(patch ?? {}) } } }
}

// Constrói o patch de contadores (golos/faltas) para um evento. `delta` é +1 ao
// adicionar e -1 ao anular. Decrementos nunca descem abaixo de 0.
function scorePatchForEvent(
  match: Match,
  eventType: EventType,
  side: 'home' | 'away',
  delta: 1 | -1,
  period: Match['current_period'] = match.current_period
): Partial<Match> | null {
  const bump = (current: number) => Math.max(0, current + delta)

  switch (eventType) {
    // Um penálti convertido durante o jogo conta como golo no marcador.
    case 'goal':
    case 'penalty_scored':
      return side === 'home'
        ? { home_score: bump(match.home_score) }
        : { away_score: bump(match.away_score) }

    case 'own_goal':
      // Golo na própria baliza conta para o adversário.
      return side === 'home'
        ? { away_score: bump(match.away_score) }
        : { home_score: bump(match.home_score) }

    case 'foul': {
      const col = foulsColumn(side, period)
      if (!col) return null
      return { [col]: bump(match[col] as number) } as Partial<Match>
    }

    default:
      // Cartões e penáltis (registados via addPenaltyKick) não mexem aqui.
      return null
  }
}

// ---------------------------------------------------------------------------
// Penáltis
// ---------------------------------------------------------------------------

export async function addPenaltyKick(
  matchId: string,
  kick: PenaltyKickInput
): Promise<ActionResult<{ kick: PenaltyKick; match: Match }>> {
  const supabase = await createClient()
  const auth = await requireMatchStaff(supabase, matchId)
  if ('error' in auth) return { success: false, error: auth.error }

  const { count } = await supabase
    .from('penalty_kicks')
    .select('id', { count: 'exact', head: true })
    .eq('match_id', matchId)
    .eq('team_id', kick.team_id)

  const { data: created, error } = await supabase
    .from('penalty_kicks')
    .insert({
      match_id: matchId,
      team_id: kick.team_id,
      player_id: kick.player_id ?? null,
      player_name: kick.player_name?.trim() || null,
      kick_order: (count ?? 0) + 1,
      scored: kick.scored,
    })
    .select('*')
    .single()

  if (error || !created) {
    return { success: false, error: 'Não foi possível registar o penálti.' }
  }

  let patch: Partial<Match> = {}
  if (kick.scored) {
    const side: 'home' | 'away' =
      kick.team_id === auth.match.home_team_id ? 'home' : 'away'
    patch =
      side === 'home'
        ? { home_penalties: (auth.match.home_penalties ?? 0) + 1 }
        : { away_penalties: (auth.match.away_penalties ?? 0) + 1 }
    await supabase.from('matches').update(patch).eq('id', matchId)
  }

  return {
    success: true,
    data: { kick: created as PenaltyKick, match: { ...auth.match, ...patch } },
  }
}
