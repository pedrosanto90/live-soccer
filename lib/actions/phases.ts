'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import {
  phaseSchema,
  groupSchema,
  drawConfigSchema,
  type PhaseInput,
  type GroupInput,
  type DrawConfigInput,
} from '@/lib/validations/phase'
import {
  randomDraw,
  seededDraw,
  generateGroupMatches,
  generateGroupNames,
  validateDrawRequirements,
  type Team as DrawTeam,
  type DrawGroup,
} from '@/lib/draw'
import {
  buildMatchSlots,
  matchDurationMinutes,
  MATCH_GAP_MINUTES,
} from '@/lib/scheduling'
import type { ActionResult } from '@/types'
import type {
  Group,
  TournamentPhase,
  TournamentSettings,
  UserRole,
} from '@/types/database'

type Supabase = Awaited<ReturnType<typeof createClient>>

const NOT_AUTH = 'Sessão expirada. Inicia sessão novamente.'
const ADMIN_ONLY = 'Apenas um administrador pode executar esta acção.'

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

async function tournamentIdOfPhase(
  supabase: Supabase,
  phaseId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('tournament_phases')
    .select('tournament_id')
    .eq('id', phaseId)
    .maybeSingle()
  return data?.tournament_id ?? null
}

async function phaseIdOfGroup(
  supabase: Supabase,
  groupId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('groups')
    .select('phase_id')
    .eq('id', groupId)
    .maybeSingle()
  return data?.phase_id ?? null
}

// Resolve utilizador + papel admin a partir de um phaseId. Devolve o erro a
// propagar (ou null) e o tournament_id quando autorizado.
async function requireAdminForPhase(
  supabase: Supabase,
  phaseId: string
): Promise<{ tournamentId: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: NOT_AUTH }

  const tournamentId = await tournamentIdOfPhase(supabase, phaseId)
  if (!tournamentId) return { error: 'Fase não encontrada.' }

  const role = await memberRole(supabase, tournamentId, user.id)
  if (role !== 'admin') return { error: ADMIN_ONLY }

  return { tournamentId }
}

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

export async function createPhase(
  tournamentId: string,
  values: PhaseInput
): Promise<ActionResult<TournamentPhase>> {
  const parsed = phaseSchema.safeParse(values)
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
  if (role !== 'admin') return { success: false, error: ADMIN_ONLY }

  // Acrescenta no fim — order_index = nº de fases existentes.
  const { count } = await supabase
    .from('tournament_phases')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)

  const { data, error } = await supabase
    .from('tournament_phases')
    .insert({
      tournament_id: tournamentId,
      name: parsed.data.name,
      type: parsed.data.type,
      order_index: count ?? 0,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { success: false, error: 'Não foi possível criar a fase. Tenta novamente.' }
  }

  revalidatePath(`/tournaments/${tournamentId}/phases`)
  return { success: true, data: data as TournamentPhase }
}

export async function updatePhase(
  phaseId: string,
  values: PhaseInput
): Promise<ActionResult<TournamentPhase>> {
  const parsed = phaseSchema.safeParse(values)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
    }
  }

  const supabase = await createClient()
  const auth = await requireAdminForPhase(supabase, phaseId)
  if ('error' in auth) return { success: false, error: auth.error }

  // O order_index é gerido pelo reorderPhases — aqui só nome e tipo.
  const { data, error } = await supabase
    .from('tournament_phases')
    .update({ name: parsed.data.name, type: parsed.data.type })
    .eq('id', phaseId)
    .select('*')
    .single()

  if (error || !data) {
    return { success: false, error: 'Não foi possível guardar as alterações.' }
  }

  revalidatePath(`/tournaments/${auth.tournamentId}/phases`)
  return { success: true, data: data as TournamentPhase }
}

export async function deletePhase(phaseId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const auth = await requireAdminForPhase(supabase, phaseId)
  if ('error' in auth) return { success: false, error: auth.error }

  // Só é possível apagar fases sem jogos associados.
  const { count } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('phase_id', phaseId)

  if ((count ?? 0) > 0) {
    return {
      success: false,
      error: 'Não é possível apagar uma fase que já tem jogos. Refaz o sorteio primeiro.',
    }
  }

  // Grupos e group_teams são apagados em cascade pela BD.
  const { error } = await supabase
    .from('tournament_phases')
    .delete()
    .eq('id', phaseId)

  if (error) {
    return { success: false, error: 'Não foi possível apagar a fase.' }
  }

  revalidatePath(`/tournaments/${auth.tournamentId}/phases`)
  return { success: true, data: undefined }
}

export async function reorderPhases(
  tournamentId: string,
  phaseIds: string[]
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: NOT_AUTH }

  const role = await memberRole(supabase, tournamentId, user.id)
  if (role !== 'admin') return { success: false, error: ADMIN_ONLY }

  // Actualiza o order_index de cada fase em sequência (filtrando sempre pelo
  // torneio — o RLS reforça que pertencem a este torneio).
  const results = await Promise.all(
    phaseIds.map((id, index) =>
      supabase
        .from('tournament_phases')
        .update({ order_index: index })
        .eq('id', id)
        .eq('tournament_id', tournamentId)
    )
  )

  if (results.some((r) => r.error)) {
    return { success: false, error: 'Não foi possível reordenar as fases.' }
  }

  revalidatePath(`/tournaments/${tournamentId}/phases`)
  return { success: true, data: undefined }
}

// ---------------------------------------------------------------------------
// Grupos
// ---------------------------------------------------------------------------

export async function createGroup(
  phaseId: string,
  values: GroupInput
): Promise<ActionResult<Group>> {
  const parsed = groupSchema.safeParse(values)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
    }
  }

  const supabase = await createClient()
  const auth = await requireAdminForPhase(supabase, phaseId)
  if ('error' in auth) return { success: false, error: auth.error }

  const { data, error } = await supabase
    .from('groups')
    .insert({
      phase_id: phaseId,
      name: parsed.data.name,
      order_index: parsed.data.order_index,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { success: false, error: 'Não foi possível criar o grupo.' }
  }

  revalidatePath(`/tournaments/${auth.tournamentId}/phases`)
  return { success: true, data: data as Group }
}

export async function deleteGroup(groupId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const phaseId = await phaseIdOfGroup(supabase, groupId)
  if (!phaseId) return { success: false, error: 'Grupo não encontrado.' }

  const auth = await requireAdminForPhase(supabase, phaseId)
  if ('error' in auth) return { success: false, error: auth.error }

  // Só é possível apagar grupos sem equipas.
  const { count } = await supabase
    .from('group_teams')
    .select('team_id', { count: 'exact', head: true })
    .eq('group_id', groupId)

  if ((count ?? 0) > 0) {
    return {
      success: false,
      error: 'Não é possível apagar um grupo com equipas. Refaz o sorteio primeiro.',
    }
  }

  const { error } = await supabase.from('groups').delete().eq('id', groupId)
  if (error) {
    return { success: false, error: 'Não foi possível apagar o grupo.' }
  }

  revalidatePath(`/tournaments/${auth.tournamentId}/phases`)
  return { success: true, data: undefined }
}

// ---------------------------------------------------------------------------
// Sorteio
// ---------------------------------------------------------------------------

export async function runDraw(
  phaseId: string,
  config: DrawConfigInput
): Promise<ActionResult<{ groups: Group[]; matches_created: number }>> {
  const parsed = drawConfigSchema.safeParse(config)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Configuração inválida',
    }
  }
  const cfg = parsed.data

  const supabase = await createClient()
  const auth = await requireAdminForPhase(supabase, phaseId)
  if ('error' in auth) return { success: false, error: auth.error }
  const { tournamentId } = auth

  // A fase tem de ser do tipo 'group'.
  const { data: phase } = await supabase
    .from('tournament_phases')
    .select('type')
    .eq('id', phaseId)
    .maybeSingle()
  if (!phase) return { success: false, error: 'Fase não encontrada.' }
  if (phase.type !== 'group') {
    return { success: false, error: 'O sorteio só se aplica a fases de grupos.' }
  }

  // O sorteio ainda não pode ter sido feito (não há grupos nesta fase).
  const { count: existingGroups } = await supabase
    .from('groups')
    .select('id', { count: 'exact', head: true })
    .eq('phase_id', phaseId)
  if ((existingGroups ?? 0) > 0) {
    return {
      success: false,
      error: 'O sorteio já foi feito. Refá-lo para voltar a sortear.',
    }
  }

  // Carrega todas as equipas do torneio.
  const { data: teamsData, error: teamsError } = await supabase
    .from('teams')
    .select('id, name')
    .eq('tournament_id', tournamentId)
    .order('name', { ascending: true })

  if (teamsError || !teamsData) {
    return { success: false, error: 'Não foi possível carregar as equipas.' }
  }
  const teams = teamsData as DrawTeam[]

  // Valida requisitos.
  const requirements = validateDrawRequirements(
    teams.length,
    cfg.num_groups,
    cfg.teams_per_group
  )
  if (!requirements.valid) {
    return { success: false, error: requirements.error ?? 'Configuração inválida.' }
  }

  // Executa o sorteio.
  const groupNames = generateGroupNames(cfg.num_groups)
  let drawn: DrawGroup[]
  try {
    if (cfg.mode === 'seeded') {
      const seedIds = cfg.seeds ?? []
      if (seedIds.length !== cfg.num_groups) {
        return {
          success: false,
          error: 'Escolhe uma cabeça de série para cada grupo.',
        }
      }
      const byId = new Map(teams.map((t) => [t.id, t]))
      const seeds: DrawTeam[] = []
      for (const id of seedIds) {
        const team = byId.get(id)
        if (!team) {
          return { success: false, error: 'Cabeça de série inválida.' }
        }
        seeds.push(team)
      }
      drawn = seededDraw(
        teams,
        seeds,
        cfg.num_groups,
        cfg.teams_per_group,
        groupNames
      )
    } else {
      drawn = randomDraw(teams, cfg.num_groups, cfg.teams_per_group, groupNames)
    }
  } catch {
    return { success: false, error: 'Não foi possível gerar o sorteio.' }
  }

  // Persiste os grupos.
  const { data: createdGroups, error: groupsError } = await supabase
    .from('groups')
    .insert(
      drawn.map((g, i) => ({ phase_id: phaseId, name: g.name, order_index: i }))
    )
    .select('*')

  if (groupsError || !createdGroups) {
    return { success: false, error: 'Não foi possível criar os grupos.' }
  }
  const groups = createdGroups as Group[]

  // Insere as equipas em group_teams (o trigger inicializa as standings).
  const groupTeamRows = drawn.flatMap((g, i) =>
    g.teams.map((t) => ({ group_id: groups[i].id, team_id: t.id }))
  )
  const { error: gtError } = await supabase
    .from('group_teams')
    .insert(groupTeamRows)
  if (gtError) {
    // Reverte os grupos para não deixar o sorteio a meio.
    await supabase
      .from('groups')
      .delete()
      .in(
        'id',
        groups.map((g) => g.id)
      )
    return { success: false, error: 'Não foi possível distribuir as equipas.' }
  }

  // Gera os jogos (round-robin), mapeando group_index → group_id.
  const generated = generateGroupMatches(drawn)

  // Agendamento automático: distribui os jogos pelo horário diário do torneio,
  // com a folga padrão entre jogos. Continua a seguir aos jogos já agendados
  // (offset) para não reutilizar horários ocupados.
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('settings')
    .eq('id', tournamentId)
    .maybeSingle()
  const settings = (tournament?.settings ?? null) as Partial<TournamentSettings> | null
  const { count: scheduledCount } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .not('scheduled_at', 'is', null)
  const offset = scheduledCount ?? 0
  const slots = buildMatchSlots(
    settings?.daily_schedule ?? [],
    matchDurationMinutes(settings?.match),
    MATCH_GAP_MINUTES,
    offset + generated.length
  )

  const matchRows = generated.map((m, i) => ({
    tournament_id: tournamentId,
    phase_id: phaseId,
    group_id: groups[m.group_index].id,
    home_team_id: m.home_team_id,
    away_team_id: m.away_team_id,
    status: 'scheduled' as const,
    scheduled_at: slots[offset + i] ?? null,
  }))

  if (matchRows.length > 0) {
    const { error: matchesError } = await supabase
      .from('matches')
      .insert(matchRows)
    if (matchesError) {
      return {
        success: false,
        error: 'Os grupos foram criados, mas não foi possível gerar todos os jogos.',
      }
    }
  }

  revalidatePath(`/tournaments/${tournamentId}/phases`)
  revalidatePath(`/tournaments/${tournamentId}/matches`)
  return {
    success: true,
    data: { groups, matches_created: matchRows.length },
  }
}

export async function resetDraw(phaseId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const auth = await requireAdminForPhase(supabase, phaseId)
  if ('error' in auth) return { success: false, error: auth.error }

  // Só é permitido refazer se nenhum jogo da fase tiver saído de 'scheduled'.
  const { data: matches } = await supabase
    .from('matches')
    .select('status')
    .eq('phase_id', phaseId)

  const started = (matches ?? []).some((m) => m.status !== 'scheduled')
  if (started) {
    return {
      success: false,
      error: 'Não é possível refazer o sorteio: já há jogos iniciados.',
    }
  }

  // Apaga os jogos primeiro (matches.group_id não tem cascade), depois os
  // grupos — group_teams e standings caem em cascade.
  const { error: matchesError } = await supabase
    .from('matches')
    .delete()
    .eq('phase_id', phaseId)
  if (matchesError) {
    return { success: false, error: 'Não foi possível apagar os jogos da fase.' }
  }

  const { error: groupsError } = await supabase
    .from('groups')
    .delete()
    .eq('phase_id', phaseId)
  if (groupsError) {
    return { success: false, error: 'Não foi possível apagar os grupos da fase.' }
  }

  revalidatePath(`/tournaments/${auth.tournamentId}/phases`)
  revalidatePath(`/tournaments/${auth.tournamentId}/matches`)
  return { success: true, data: undefined }
}
