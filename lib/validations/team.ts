import { z } from 'zod'

import { TIERS } from '@/lib/tiers'

// Schemas de validação de equipas e jogadores, partilhados entre as Server
// Actions e os formulários client-side (react-hook-form).

export const teamSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(60),
  tier: z.enum(TIERS).default('seniors'),
  short_name: z
    .string()
    .max(5, 'Abreviatura deve ter no máximo 5 caracteres')
    .optional(),
  color_primary: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida')
    .default('#000000'),
  color_secondary: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida')
    .default('#ffffff'),
})

export const playerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(60),
  number: z.number().int().min(1).max(99).optional().nullable(),
  position: z
    .enum(['goalkeeper', 'defender', 'midfielder', 'forward'])
    .optional()
    .nullable(),
  is_active: z.boolean().default(true),
})

export type TeamInput = z.infer<typeof teamSchema>
export type PlayerInput = z.infer<typeof playerSchema>

export const positionLabels: Record<string, string> = {
  goalkeeper: 'Guarda-redes',
  defender: 'Defesa',
  midfielder: 'Médio',
  forward: 'Avançado',
}
