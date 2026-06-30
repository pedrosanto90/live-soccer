'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { tournamentSchema, type TournamentInput } from '@/lib/validations/tournament'
import { buildTournamentSettings, generateSlug } from '@/lib/utils'
import type { ActionResult } from '@/types'
import type { Tournament, TournamentStatus } from '@/types/database'

// Gera um slug único, acrescentando um sufixo aleatório se já existir.
async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string
): Promise<string> {
  let slug = generateSlug(name)
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data } = await supabase
      .from('tournaments')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (!data) return slug
    slug = generateSlug(name, Math.random().toString(36).slice(2, 6))
  }
  // Fallback altamente improvável: sufixo baseado no tempo.
  return generateSlug(name, Date.now().toString(36).slice(-4))
}

export async function createTournament(
  values: TournamentInput
): Promise<ActionResult> {
  const parsed = tournamentSchema.safeParse(values)
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

  if (!user) {
    return { success: false, error: 'Sessão expirada. Inicia sessão novamente.' }
  }

  const slug = await uniqueSlug(supabase, parsed.data.name)

  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      created_by: user.id,
      name: parsed.data.name,
      slug,
      description: parsed.data.description || null,
      visibility: parsed.data.visibility,
      starts_at: parsed.data.starts_at || null,
      ends_at: parsed.data.ends_at || null,
      settings: buildTournamentSettings(parsed.data),
      multi_tier: parsed.data.multi_tier,
      tier_schedule: parsed.data.tier_schedule,
      finals_order: parsed.data.finals_order,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { success: false, error: 'Não foi possível criar o torneio. Tenta novamente.' }
  }

  // O trigger handle_new_tournament adiciona o criador como admin.
  revalidatePath('/dashboard')
  redirect(`/tournaments/${data.id}`)
}

export async function updateTournament(
  id: string,
  values: TournamentInput
): Promise<ActionResult<Tournament>> {
  const parsed = tournamentSchema.safeParse(values)
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

  if (!user) {
    return { success: false, error: 'Sessão expirada. Inicia sessão novamente.' }
  }

  const { data: membership } = await supabase
    .from('tournament_members')
    .select('role')
    .eq('tournament_id', id)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (membership?.role !== 'admin') {
    return { success: false, error: 'Não tens permissão para editar este torneio.' }
  }

  // O slug não é alterado nas edições.
  const { data, error } = await supabase
    .from('tournaments')
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      visibility: parsed.data.visibility,
      starts_at: parsed.data.starts_at || null,
      ends_at: parsed.data.ends_at || null,
      settings: buildTournamentSettings(parsed.data),
      multi_tier: parsed.data.multi_tier,
      tier_schedule: parsed.data.tier_schedule,
      finals_order: parsed.data.finals_order,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    return { success: false, error: 'Não foi possível guardar as alterações.' }
  }

  revalidatePath(`/tournaments/${id}`)
  revalidatePath('/dashboard')
  return { success: true, data: data as Tournament }
}

const allowedTransitions: Record<TournamentStatus, TournamentStatus[]> = {
  draft: ['active', 'cancelled'],
  active: ['finished', 'cancelled'],
  finished: [],
  cancelled: [],
}

export async function updateTournamentStatus(
  id: string,
  status: TournamentStatus
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Sessão expirada. Inicia sessão novamente.' }
  }

  const { data: membership } = await supabase
    .from('tournament_members')
    .select('role')
    .eq('tournament_id', id)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (membership?.role !== 'admin') {
    return { success: false, error: 'Não tens permissão para gerir este torneio.' }
  }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('status')
    .eq('id', id)
    .maybeSingle()

  if (!tournament) {
    return { success: false, error: 'Torneio não encontrado.' }
  }

  const current = tournament.status as TournamentStatus
  if (!allowedTransitions[current].includes(status)) {
    return { success: false, error: 'Transição de estado não permitida.' }
  }

  const { error } = await supabase
    .from('tournaments')
    .update({ status })
    .eq('id', id)

  if (error) {
    return { success: false, error: 'Não foi possível actualizar o estado.' }
  }

  revalidatePath(`/tournaments/${id}`)
  revalidatePath('/dashboard')
  return { success: true, data: undefined }
}
