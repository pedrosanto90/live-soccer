'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import {
  teamSchema,
  playerSchema,
  type TeamInput,
  type PlayerInput,
} from '@/lib/validations/team'
import type { ActionResult } from '@/types'
import type { Team, Player, UserRole } from '@/types/database'

type Supabase = Awaited<ReturnType<typeof createClient>>

const NOT_AUTH = 'Sessão expirada. Inicia sessão novamente.'
const NO_ACCESS = 'Não tens permissão para gerir as equipas deste torneio.'

// Devolve o papel do utilizador autenticado no torneio, ou null se não for
// membro / não estiver autenticado.
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

// Carrega o tournament_id de uma equipa (para resolver permissões a partir do
// teamId / playerId).
async function tournamentIdOfTeam(
  supabase: Supabase,
  teamId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('teams')
    .select('tournament_id')
    .eq('id', teamId)
    .maybeSingle()
  return data?.tournament_id ?? null
}

export async function createTeam(
  tournamentId: string,
  values: TeamInput
): Promise<ActionResult<Team>> {
  const parsed = teamSchema.safeParse(values)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: NOT_AUTH }

  const role = await memberRole(supabase, tournamentId, user.id)
  if (role !== 'admin' && role !== 'operator') {
    return { success: false, error: NO_ACCESS }
  }

  // Nome único por escalão dentro do torneio
  // (constraint unique (tournament_id, name, tier)).
  const { data: existing } = await supabase
    .from('teams')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('name', parsed.data.name)
    .eq('tier', parsed.data.tier)
    .maybeSingle()
  if (existing) {
    return {
      success: false,
      error: 'Já existe uma equipa com este nome neste escalão.',
    }
  }

  const { data, error } = await supabase
    .from('teams')
    .insert({
      tournament_id: tournamentId,
      name: parsed.data.name,
      tier: parsed.data.tier,
      short_name: parsed.data.short_name || null,
      color_primary: parsed.data.color_primary,
      color_secondary: parsed.data.color_secondary,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { success: false, error: 'Não foi possível criar a equipa. Tenta novamente.' }
  }

  revalidatePath(`/tournaments/${tournamentId}/teams`)
  return { success: true, data: data as Team }
}

export async function updateTeam(
  teamId: string,
  values: TeamInput
): Promise<ActionResult<Team>> {
  const parsed = teamSchema.safeParse(values)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: NOT_AUTH }

  const { data: current } = await supabase
    .from('teams')
    .select('tournament_id, tier')
    .eq('id', teamId)
    .maybeSingle()
  if (!current) return { success: false, error: 'Equipa não encontrada.' }
  const tournamentId = current.tournament_id

  const role = await memberRole(supabase, tournamentId, user.id)
  if (role !== 'admin' && role !== 'operator') {
    return { success: false, error: NO_ACCESS }
  }

  // O escalão só pode mudar enquanto a equipa não estiver em nenhum grupo —
  // mudar de escalão depois do sorteio quebraria a separação por escalão.
  if (parsed.data.tier !== current.tier) {
    const { count } = await supabase
      .from('group_teams')
      .select('team_id', { count: 'exact', head: true })
      .eq('team_id', teamId)
    if ((count ?? 0) > 0) {
      return {
        success: false,
        error: 'Não é possível mudar o escalão de uma equipa que já está num grupo.',
      }
    }
  }

  // Outra equipa com o mesmo nome neste escalão?
  const { data: clash } = await supabase
    .from('teams')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('name', parsed.data.name)
    .eq('tier', parsed.data.tier)
    .neq('id', teamId)
    .maybeSingle()
  if (clash) {
    return {
      success: false,
      error: 'Já existe uma equipa com este nome neste escalão.',
    }
  }

  const { data, error } = await supabase
    .from('teams')
    .update({
      name: parsed.data.name,
      tier: parsed.data.tier,
      short_name: parsed.data.short_name || null,
      color_primary: parsed.data.color_primary,
      color_secondary: parsed.data.color_secondary,
    })
    .eq('id', teamId)
    .select('*')
    .single()

  if (error || !data) {
    return { success: false, error: 'Não foi possível guardar as alterações.' }
  }

  revalidatePath(`/tournaments/${tournamentId}/teams`)
  revalidatePath(`/tournaments/${tournamentId}/teams/${teamId}`)
  return { success: true, data: data as Team }
}

export async function deleteTeam(teamId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: NOT_AUTH }

  const tournamentId = await tournamentIdOfTeam(supabase, teamId)
  if (!tournamentId) return { success: false, error: 'Equipa não encontrada.' }

  const role = await memberRole(supabase, tournamentId, user.id)
  if (role !== 'admin') {
    return { success: false, error: 'Apenas um administrador pode apagar equipas.' }
  }

  // A equipa não pode ter jogos associados (como visitada ou visitante).
  const { count } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)

  if ((count ?? 0) > 0) {
    return {
      success: false,
      error: 'Não é possível apagar uma equipa que já tem jogos associados',
    }
  }

  const { error } = await supabase.from('teams').delete().eq('id', teamId)
  if (error) {
    return { success: false, error: 'Não foi possível apagar a equipa.' }
  }

  revalidatePath(`/tournaments/${tournamentId}/teams`)
  return { success: true, data: undefined }
}

export async function createPlayer(
  teamId: string,
  values: PlayerInput
): Promise<ActionResult<Player>> {
  const parsed = playerSchema.safeParse(values)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: NOT_AUTH }

  const tournamentId = await tournamentIdOfTeam(supabase, teamId)
  if (!tournamentId) return { success: false, error: 'Equipa não encontrada.' }

  const role = await memberRole(supabase, tournamentId, user.id)
  if (role !== 'admin' && role !== 'operator') {
    return { success: false, error: NO_ACCESS }
  }

  // Número único dentro da equipa, quando fornecido.
  if (parsed.data.number != null) {
    const { data: clash } = await supabase
      .from('players')
      .select('id')
      .eq('team_id', teamId)
      .eq('number', parsed.data.number)
      .maybeSingle()
    if (clash) {
      return { success: false, error: 'Já existe um jogador com esse número.' }
    }
  }

  const { data, error } = await supabase
    .from('players')
    .insert({
      team_id: teamId,
      name: parsed.data.name,
      number: parsed.data.number ?? null,
      position: parsed.data.position ?? null,
      is_active: parsed.data.is_active,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { success: false, error: 'Não foi possível adicionar o jogador.' }
  }

  revalidatePath(`/tournaments/${tournamentId}/teams/${teamId}`)
  return { success: true, data: data as Player }
}

export async function updatePlayer(
  playerId: string,
  values: PlayerInput
): Promise<ActionResult<Player>> {
  const parsed = playerSchema.safeParse(values)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: NOT_AUTH }

  const { data: player } = await supabase
    .from('players')
    .select('team_id')
    .eq('id', playerId)
    .maybeSingle()
  if (!player) return { success: false, error: 'Jogador não encontrado.' }

  const teamId = player.team_id
  const tournamentId = await tournamentIdOfTeam(supabase, teamId)
  if (!tournamentId) return { success: false, error: 'Equipa não encontrada.' }

  const role = await memberRole(supabase, tournamentId, user.id)
  if (role !== 'admin' && role !== 'operator') {
    return { success: false, error: NO_ACCESS }
  }

  if (parsed.data.number != null) {
    const { data: clash } = await supabase
      .from('players')
      .select('id')
      .eq('team_id', teamId)
      .eq('number', parsed.data.number)
      .neq('id', playerId)
      .maybeSingle()
    if (clash) {
      return { success: false, error: 'Já existe um jogador com esse número.' }
    }
  }

  const { data, error } = await supabase
    .from('players')
    .update({
      name: parsed.data.name,
      number: parsed.data.number ?? null,
      position: parsed.data.position ?? null,
      is_active: parsed.data.is_active,
    })
    .eq('id', playerId)
    .select('*')
    .single()

  if (error || !data) {
    return { success: false, error: 'Não foi possível guardar o jogador.' }
  }

  revalidatePath(`/tournaments/${tournamentId}/teams/${teamId}`)
  return { success: true, data: data as Player }
}

export async function deletePlayer(playerId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: NOT_AUTH }

  const { data: player } = await supabase
    .from('players')
    .select('team_id')
    .eq('id', playerId)
    .maybeSingle()
  if (!player) return { success: false, error: 'Jogador não encontrado.' }

  const tournamentId = await tournamentIdOfTeam(supabase, player.team_id)
  if (!tournamentId) return { success: false, error: 'Equipa não encontrada.' }

  const role = await memberRole(supabase, tournamentId, user.id)
  if (role !== 'admin' && role !== 'operator') {
    return { success: false, error: NO_ACCESS }
  }

  const { error } = await supabase.from('players').delete().eq('id', playerId)
  if (error) {
    return { success: false, error: 'Não foi possível remover o jogador.' }
  }

  revalidatePath(`/tournaments/${tournamentId}/teams/${player.team_id}`)
  return { success: true, data: undefined }
}

export async function togglePlayerActive(
  playerId: string
): Promise<ActionResult<{ is_active: boolean }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: NOT_AUTH }

  const { data: player } = await supabase
    .from('players')
    .select('team_id, is_active')
    .eq('id', playerId)
    .maybeSingle()
  if (!player) return { success: false, error: 'Jogador não encontrado.' }

  const tournamentId = await tournamentIdOfTeam(supabase, player.team_id)
  if (!tournamentId) return { success: false, error: 'Equipa não encontrada.' }

  const role = await memberRole(supabase, tournamentId, user.id)
  if (role !== 'admin' && role !== 'operator') {
    return { success: false, error: NO_ACCESS }
  }

  const next = !player.is_active
  const { error } = await supabase
    .from('players')
    .update({ is_active: next })
    .eq('id', playerId)

  if (error) {
    return { success: false, error: 'Não foi possível actualizar o jogador.' }
  }

  revalidatePath(`/tournaments/${tournamentId}/teams/${player.team_id}`)
  return { success: true, data: { is_active: next } }
}
