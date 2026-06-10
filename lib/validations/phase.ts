import { z } from 'zod'

// Schemas de validação de fases, grupos e configuração do sorteio. Partilhados
// entre as Server Actions e os componentes client-side.

export const phaseSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(60),
  type: z.enum(['group', 'knockout']),
  order_index: z.number().int().min(0).default(0),
})

export const groupSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(30),
  order_index: z.number().int().min(0).default(0),
})

export const drawConfigSchema = z.object({
  mode: z.enum(['random', 'seeded']),
  // IDs das equipas cabeças de série (uma por grupo, na ordem dos grupos).
  // Só relevante quando mode === 'seeded'.
  seeds: z.array(z.string().uuid()).optional(),
  // Nº de equipas por grupo.
  teams_per_group: z.number().int().min(2).max(8),
  // Nº de grupos a criar.
  num_groups: z.number().int().min(1).max(16),
})

export type PhaseInput = z.infer<typeof phaseSchema>
export type GroupInput = z.infer<typeof groupSchema>
export type DrawConfigInput = z.infer<typeof drawConfigSchema>

// Sugestões de nome ao escolher o tipo de fase (editáveis pelo utilizador).
export const phaseTypeLabels: Record<PhaseInput['type'], string> = {
  group: 'Fase de Grupos',
  knockout: 'Eliminatórias',
}
