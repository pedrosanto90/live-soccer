'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import {
  matchSchema,
  scheduleMatchSchema,
  type MatchInput,
  type ScheduleMatchInput,
} from '@/lib/validations/match'
import type { ActionResult } from '@/types'
import type { Match, TournamentSettings, UserRole } from '@/types/database'

type Supabase = Awaited<ReturnType<typeof createClient>>

const NOT_AUTH = 'Sessão expirada. Inicia sessão novamente.'
const ADMIN_ONLY = 'Apenas um administrador pode executar esta acção.'
const STAFF_ONLY = 'Não tens permissão para executar esta acção.'
const NOT_SCHEDULED = 'Não é possível editar um jogo que já foi iniciado.'

// Papel do utilizador autenticado no torneio (ou null se não for membro).
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

// Resolve o utilizador e exige que seja admin/operator do torneio indicado.
async function requireStaff(
  supabase: Supabase,
  tournamentId: string
): Promise<{ userId: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: NOT_AUTH }

  const role = await memberRole(supabase, tournamentId, user.id)
  if (role !== 'admin' && role !== 'operator') return { error: STAFF_ONLY }

  return { userId: user.id }
}

async function getMatchRow(
  supabase: Supabase,
  matchId: string
): Promise<Pick<Match, 'id' | 'tournament_id' | 'status'> | null> {
  const { data } = await supabase
    .from('matches')
    .select('id, tournament_id, status')
    .eq('id', matchId)
    .maybeSingle()
  return (data as Pick<Match, 'id' | 'tournament_id' | 'status'> | null) ?? null
}

// Normaliza os campos opcionais do formulário para o que a BD espera.
function normalize(values: MatchInput) {
  return {
    group_id: values.group_id || null,
    referee_id: values.referee_id || null,
    venue: values.venue?.trim() || null,
    scheduled_at: values.scheduled_at || null,
    settings_override:
      (values.settings_override as Partial<TournamentSettings> | null) ?? null,
  }
}

// ---------------------------------------------------------------------------
// Criação
// ---------------------------------------------------------------------------

export async function createMatch(
  tournamentId: string,
  values: MatchInput
): Promise<ActionResult<Match>> {
  const parsed = matchSchema.safeParse(values)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
    }
  }
  const data = parsed.data

  const supabase = await createClient()
  const auth = await requireStaff(supabase, tournamentId)
  if ('error' in auth) return { success: false, error: auth.error }

  // A fase tem de pertencer a este torneio.
  const { data: phase } = await supabase
    .from('tournament_phases')
    .select('id')
    .eq('id', data.phase_id)
    .eq('tournament_id', tournamentId)
    .maybeSingle()
  if (!phase) return { success: false, error: 'Fase inválida para este torneio.' }

  // Ambas as equipas têm de pertencer ao torneio.
  const { count: teamsCount } = await supabase
    .from('teams')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .in('id', [data.home_team_id, data.away_team_id])
  if ((teamsCount ?? 0) < 2) {
    return { success: false, error: 'As equipas têm de pertencer ao torneio.' }
  }

  // Sem jogos repetidos entre as mesmas equipas no mesmo grupo.
  if (data.group_id) {
    const { count: dup } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', data.group_id)
      .or(
        `and(home_team_id.eq.${data.home_team_id},away_team_id.eq.${data.away_team_id}),and(home_team_id.eq.${data.away_team_id},away_team_id.eq.${data.home_team_id})`
      )
    if ((dup ?? 0) > 0) {
      return {
        success: false,
        error: 'Já existe um jogo entre estas equipas neste grupo.',
      }
    }
  }

  const norm = normalize(data)
  const { data: created, error } = await supabase
    .from('matches')
    .insert({
      tournament_id: tournamentId,
      phase_id: data.phase_id,
      group_id: norm.group_id,
      home_team_id: data.home_team_id,
      away_team_id: data.away_team_id,
      referee_id: norm.referee_id,
      venue: norm.venue,
      scheduled_at: norm.scheduled_at,
      settings_override: norm.settings_override,
      status: 'scheduled',
    })
    .select('*')
    .single()

  if (error || !created) {
    return { success: false, error: 'Não foi possível criar o jogo. Tenta novamente.' }
  }

  revalidatePath(`/tournaments/${tournamentId}/matches`)
  return { success: true, data: created as Match }
}

// ---------------------------------------------------------------------------
// Edição
// ---------------------------------------------------------------------------

export async function updateMatch(
  matchId: string,
  values: MatchInput
): Promise<ActionResult<Match>> {
  const parsed = matchSchema.safeParse(values)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
    }
  }
  const data = parsed.data

  const supabase = await createClient()

  const match = await getMatchRow(supabase, matchId)
  if (!match) return { success: false, error: 'Jogo não encontrado.' }
  if (match.status !== 'scheduled') {
    return { success: false, error: NOT_SCHEDULED }
  }

  const auth = await requireStaff(supabase, match.tournament_id)
  if ('error' in auth) return { success: false, error: auth.error }

  const norm = normalize(data)
  const { data: updated, error } = await supabase
    .from('matches')
    .update({
      phase_id: data.phase_id,
      group_id: norm.group_id,
      home_team_id: data.home_team_id,
      away_team_id: data.away_team_id,
      referee_id: norm.referee_id,
      venue: norm.venue,
      scheduled_at: norm.scheduled_at,
      settings_override: norm.settings_override,
    })
    .eq('id', matchId)
    .select('*')
    .single()

  if (error || !updated) {
    return { success: false, error: 'Não foi possível guardar as alterações.' }
  }

  revalidatePath(`/tournaments/${match.tournament_id}/matches`)
  revalidatePath(`/tournaments/${match.tournament_id}/matches/${matchId}`)
  return { success: true, data: updated as Match }
}

// ---------------------------------------------------------------------------
// Agendamento (data/hora, campo e árbitro)
// ---------------------------------------------------------------------------

export async function scheduleMatch(
  matchId: string,
  values: ScheduleMatchInput
): Promise<ActionResult<Match>> {
  const parsed = scheduleMatchSchema.safeParse(values)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
    }
  }
  const data = parsed.data

  const supabase = await createClient()

  const match = await getMatchRow(supabase, matchId)
  if (!match) return { success: false, error: 'Jogo não encontrado.' }
  if (match.status !== 'scheduled' && match.status !== 'in_progress') {
    return {
      success: false,
      error: 'Só é possível agendar jogos por iniciar ou em curso.',
    }
  }

  const auth = await requireStaff(supabase, match.tournament_id)
  if ('error' in auth) return { success: false, error: auth.error }

  const { data: updated, error } = await supabase
    .from('matches')
    .update({
      venue: data.venue?.trim() || null,
      scheduled_at: data.scheduled_at || null,
      referee_id: data.referee_id || null,
    })
    .eq('id', matchId)
    .select('*')
    .single()

  if (error || !updated) {
    return { success: false, error: 'Não foi possível agendar o jogo.' }
  }

  revalidatePath(`/tournaments/${match.tournament_id}/matches`)
  revalidatePath(`/tournaments/${match.tournament_id}/matches/${matchId}`)
  return { success: true, data: updated as Match }
}

// ---------------------------------------------------------------------------
// Eliminação
// ---------------------------------------------------------------------------

export async function deleteMatch(matchId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const match = await getMatchRow(supabase, matchId)
  if (!match) return { success: false, error: 'Jogo não encontrado.' }
  if (match.status !== 'scheduled') {
    return {
      success: false,
      error: 'Só é possível apagar jogos por iniciar.',
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: NOT_AUTH }

  const role = await memberRole(supabase, match.tournament_id, user.id)
  if (role !== 'admin') return { success: false, error: ADMIN_ONLY }

  const { error } = await supabase.from('matches').delete().eq('id', matchId)
  if (error) {
    return { success: false, error: 'Não foi possível apagar o jogo.' }
  }

  revalidatePath(`/tournaments/${match.tournament_id}/matches`)
  return { success: true, data: undefined }
}
