import { describe, it, expect } from 'vitest'
import {
  signUpSchema,
  signInSchema,
  registerFormSchema,
} from '@/lib/validations/auth'

describe('signUpSchema', () => {
  it('valida dados correctos', () => {
    const result = signUpSchema.safeParse({
      name: 'João Costa',
      email: 'joao@example.com',
      password: 'secret123',
    })
    expect(result.success).toBe(true)
  })

  it('rejeita nome com menos de 2 caracteres', () => {
    const result = signUpSchema.safeParse({
      name: 'J',
      email: 'joao@example.com',
      password: 'secret123',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe(
      'O nome deve ter pelo menos 2 caracteres'
    )
  })

  it('rejeita email inválido', () => {
    const result = signUpSchema.safeParse({
      name: 'João',
      email: 'nao-e-email',
      password: 'secret123',
    })
    expect(result.success).toBe(false)
  })

  it('rejeita password com menos de 6 caracteres', () => {
    const result = signUpSchema.safeParse({
      name: 'João',
      email: 'joao@example.com',
      password: '123',
    })
    expect(result.success).toBe(false)
  })
})

describe('registerFormSchema', () => {
  it('valida quando as passwords coincidem', () => {
    const result = registerFormSchema.safeParse({
      name: 'João',
      email: 'joao@example.com',
      password: 'secret123',
      confirmPassword: 'secret123',
    })
    expect(result.success).toBe(true)
  })

  it('rejeita passwords que não coincidem', () => {
    const result = registerFormSchema.safeParse({
      name: 'João',
      email: 'joao@example.com',
      password: 'secret123',
      confirmPassword: 'diferente',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('As passwords não coincidem')
    expect(result.error?.issues[0].path).toContain('confirmPassword')
  })
})

describe('signInSchema', () => {
  it('valida dados correctos', () => {
    const result = signInSchema.safeParse({
      email: 'joao@example.com',
      password: 'secret123',
    })
    expect(result.success).toBe(true)
  })

  it('rejeita password vazia', () => {
    const result = signInSchema.safeParse({
      email: 'joao@example.com',
      password: '',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Introduz a tua password')
  })

  it('rejeita email inválido', () => {
    const result = signInSchema.safeParse({
      email: 'nao-e-email',
      password: 'secret123',
    })
    expect(result.success).toBe(false)
  })
})
