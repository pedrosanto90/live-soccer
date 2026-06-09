'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { signInSchema, signUpSchema } from '@/lib/validations/auth'
import type { SignInInput, SignUpInput } from '@/lib/validations/auth'
import type { ActionResult } from '@/types'

export async function signUp(formData: SignUpInput): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(formData)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
    }
  }

  const { name, email, password } = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // O trigger handle_new_user lê este `name` de raw_user_meta_data.
    options: { data: { name } },
  })

  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('already') || message.includes('registered')) {
      return { success: false, error: 'Este email já está registado.' }
    }
    if (message.includes('password')) {
      return { success: false, error: 'A password é demasiado fraca.' }
    }
    return { success: false, error: 'Não foi possível criar a conta. Tenta novamente.' }
  }

  // Quando a confirmação de email está ativa, o Supabase devolve um utilizador
  // sem identidades para emails já existentes (sem erro explícito).
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { success: false, error: 'Este email já está registado.' }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signIn(
  formData: SignInInput,
  redirectTo?: string
): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(formData)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
    }
  }

  const { email, password } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { success: false, error: 'Email ou password incorretos.' }
  }

  revalidatePath('/', 'layout')
  redirect(redirectTo && redirectTo.startsWith('/') ? redirectTo : '/dashboard')
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
