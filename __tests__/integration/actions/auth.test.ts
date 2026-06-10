import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { makeSupabaseMock } from '../../helpers/supabase-mock'

// As actions têm a directiva 'use server', mas em Vitest é apenas uma string
// no topo do módulo — a importação directa funciona. redirect/revalidatePath
// estão mockados no setup.

describe('signIn action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna erro com credenciais inválidas', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        signIn: { error: { message: 'Invalid login credentials' } },
      }) as never
    )

    const { signIn } = await import('@/lib/actions/auth')
    const result = await signIn({ email: 'wrong@example.com', password: 'wrong' })

    expect(result).toEqual({
      success: false,
      error: 'Email ou password incorretos.',
    })
  })

  it('redireciona para /dashboard em caso de sucesso', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({ signIn: { error: null } }) as never
    )
    const { redirect } = await import('next/navigation')

    const { signIn } = await import('@/lib/actions/auth')
    await signIn({ email: 'joao@example.com', password: 'secret123' })

    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })

  it('respeita um redirectTo válido', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({ signIn: { error: null } }) as never
    )
    const { redirect } = await import('next/navigation')

    const { signIn } = await import('@/lib/actions/auth')
    await signIn({ email: 'joao@example.com', password: 'secret123' }, '/tournaments/new')

    expect(redirect).toHaveBeenCalledWith('/tournaments/new')
  })

  it('rejeita dados inválidos sem chamar o Supabase', async () => {
    const { signIn } = await import('@/lib/actions/auth')
    const result = await signIn({ email: 'nao-email', password: '' })
    expect(result.success).toBe(false)
  })
})

describe('signUp action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna erro quando o email já está registado', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        signUp: { error: { message: 'User already registered' } },
      }) as never
    )

    const { signUp } = await import('@/lib/actions/auth')
    const result = await signUp({
      name: 'João',
      email: 'existente@example.com',
      password: 'secret123',
    })

    expect(result).toEqual({
      success: false,
      error: 'Este email já está registado.',
    })
  })

  it('deteta email já registado quando o Supabase devolve identities vazias', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        signUp: { data: { user: { id: 'u1', identities: [] }, session: null } },
      }) as never
    )

    const { signUp } = await import('@/lib/actions/auth')
    const result = await signUp({
      name: 'João',
      email: 'existente@example.com',
      password: 'secret123',
    })

    expect(result).toEqual({
      success: false,
      error: 'Este email já está registado.',
    })
  })

  it('redireciona para /dashboard em caso de sucesso', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        signUp: { data: { user: null, session: null }, error: null },
      }) as never
    )
    const { redirect } = await import('next/navigation')

    const { signUp } = await import('@/lib/actions/auth')
    await signUp({ name: 'João', email: 'novo@example.com', password: 'secret123' })

    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })

  it('traduz um erro de password fraca', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        signUp: { error: { message: 'Password should be at least 6 characters' } },
      }) as never
    )

    const { signUp } = await import('@/lib/actions/auth')
    const result = await signUp({
      name: 'João',
      email: 'novo@example.com',
      password: 'secret123',
    })

    expect(result).toEqual({ success: false, error: 'A password é demasiado fraca.' })
  })

  it('devolve mensagem genérica para erros inesperados', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        signUp: { error: { message: 'Unexpected failure' } },
      }) as never
    )

    const { signUp } = await import('@/lib/actions/auth')
    const result = await signUp({
      name: 'João',
      email: 'novo@example.com',
      password: 'secret123',
    })

    expect(result).toEqual({
      success: false,
      error: 'Não foi possível criar a conta. Tenta novamente.',
    })
  })

  it('rejeita dados de registo inválidos', async () => {
    const { signUp } = await import('@/lib/actions/auth')
    const result = await signUp({ name: 'J', email: 'x', password: '1' })
    expect(result.success).toBe(false)
  })
})

describe('signOut action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('termina a sessão e redireciona para /', async () => {
    vi.mocked(createClient).mockResolvedValueOnce(makeSupabaseMock() as never)
    const { redirect } = await import('next/navigation')

    const { signOut } = await import('@/lib/actions/auth')
    await signOut()

    expect(redirect).toHaveBeenCalledWith('/')
  })
})
