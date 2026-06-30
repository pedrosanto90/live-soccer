import { describe, it, expect } from 'vitest'
import { teamSchema, playerSchema } from '@/lib/validations/team'

describe('teamSchema', () => {
  it('valida equipa com dados completos', () => {
    expect(
      teamSchema.safeParse({
        name: 'Sporting CP',
        short_name: 'SCP',
        color_primary: '#006600',
        color_secondary: '#ffffff',
      }).success
    ).toBe(true)
  })

  it('valida equipa sem campos opcionais', () => {
    expect(teamSchema.safeParse({ name: 'Sporting CP' }).success).toBe(true)
  })

  it('aplica os defaults das cores quando omitidas', () => {
    const result = teamSchema.safeParse({ name: 'Sporting CP' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.color_primary).toBe('#000000')
      expect(result.data.color_secondary).toBe('#ffffff')
    }
  })

  it('rejeita nome com menos de 2 caracteres', () => {
    expect(teamSchema.safeParse({ name: 'S' }).success).toBe(false)
  })

  it('valida equipa com escalão', () => {
    expect(
      teamSchema.safeParse({
        name: 'Sporting CP',
        tier: 'seniors',
      }).success
    ).toBe(true)
  })

  it('aplica o default do escalão quando omitido', () => {
    const result = teamSchema.safeParse({ name: 'Sporting CP' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tier).toBe('seniors')
    }
  })

  it('rejeita escalão inválido', () => {
    expect(
      teamSchema.safeParse({
        name: 'Sporting CP',
        tier: 'sub17',
      }).success
    ).toBe(false)
  })

  it('rejeita abreviatura com mais de 5 caracteres', () => {
    expect(
      teamSchema.safeParse({
        name: 'Sporting CP',
        short_name: 'TOOLONG',
      }).success
    ).toBe(false)
  })

  it('rejeita cor com formato inválido', () => {
    expect(
      teamSchema.safeParse({
        name: 'Sporting CP',
        color_primary: 'verde',
      }).success
    ).toBe(false)
  })
})

describe('playerSchema', () => {
  it('valida jogador com dados completos', () => {
    expect(
      playerSchema.safeParse({
        name: 'João Silva',
        number: 10,
        position: 'forward',
        is_active: true,
      }).success
    ).toBe(true)
  })

  it('valida jogador sem campos opcionais', () => {
    expect(playerSchema.safeParse({ name: 'João Silva' }).success).toBe(true)
  })

  it('aplica o default de is_active', () => {
    const result = playerSchema.safeParse({ name: 'João Silva' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.is_active).toBe(true)
    }
  })

  it('rejeita número fora do intervalo 1-99', () => {
    expect(playerSchema.safeParse({ name: 'João', number: 100 }).success).toBe(false)
    expect(playerSchema.safeParse({ name: 'João', number: 0 }).success).toBe(false)
  })

  it('rejeita posição inválida', () => {
    expect(
      playerSchema.safeParse({
        name: 'João',
        position: 'invalid',
      }).success
    ).toBe(false)
  })
})
