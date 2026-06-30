import { z } from 'zod'

import { TIERS } from '@/lib/tiers'

// Schemas de validação de fases, grupos e configuração do sorteio. Partilhados
// entre as Server Actions e os componentes client-side.

export const phaseSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(60),
  type: z.enum(['group', 'knockout']),
  order_index: z.number().int().min(0).default(0),
  // Escalão da fase (torneios multi-escalão). Relevante nas eliminatórias, onde
  // determina de que escalão saem as equipas apuradas. `undefined` → fase
  // mono-escalão (todas as equipas).
  tier: z.enum(TIERS).optional(),
})

export const groupSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(30),
  order_index: z.number().int().min(0).default(0),
})

// Configuração do sorteio de um único escalão (ou de todo o torneio, no caso
// mono-escalão). Em torneios multi-escalão, cada escalão tem a sua própria
// configuração (ver `tiers` em `drawConfigSchema`).
export const tierDrawConfigSchema = z.object({
  tier: z.enum(TIERS),
  mode: z.enum(['random', 'seeded']),
  // IDs das equipas cabeças de série (uma por grupo, na ordem dos grupos).
  // Só relevante quando mode === 'seeded'.
  seeds: z.array(z.string().uuid()).optional(),
  teams_per_group: z.number().int().min(2).max(8),
  num_groups: z.number().int().min(1).max(16),
})

export const drawConfigSchema = z.object({
  // Configuração mono-escalão (aplicada a todas as equipas da fase). Os campos
  // são opcionais porque um sorteio multi-escalão usa antes `tiers`.
  mode: z.enum(['random', 'seeded']).optional(),
  seeds: z.array(z.string().uuid()).optional(),
  teams_per_group: z.number().int().min(2).max(8).optional(),
  num_groups: z.number().int().min(1).max(16).optional(),
  // Configuração por escalão (torneios multi-escalão). Quando presente e não
  // vazia, o sorteio é feito escalão a escalão.
  tiers: z.array(tierDrawConfigSchema).optional(),
})

export type PhaseInput = z.infer<typeof phaseSchema>
export type GroupInput = z.infer<typeof groupSchema>
export type TierDrawConfigInput = z.infer<typeof tierDrawConfigSchema>
export type DrawConfigInput = z.infer<typeof drawConfigSchema>

// Sugestões de nome ao escolher o tipo de fase (editáveis pelo utilizador).
export const phaseTypeLabels: Record<PhaseInput['type'], string> = {
  group: 'Fase de Grupos',
  knockout: 'Eliminatórias',
}
