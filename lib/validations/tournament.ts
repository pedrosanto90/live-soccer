import { z } from 'zod'

// Schema de validação de torneios, partilhado entre a Server Action e o
// formulário client-side (react-hook-form).

const matchSettingsSchema = z.object({
  half_duration_minutes: z.number().min(5).max(45).default(20),
  half_time_duration_minutes: z.number().min(1).max(20).default(5),
  extra_time_duration_minutes: z.number().min(1).max(20).default(5),
  max_fouls_per_team_per_half: z.number().min(1).max(10).default(5),
  penalty_shootout_kicks: z.number().min(3).max(10).default(5),
})

const scoringSchema = z.object({
  points_win: z.number().min(1).max(5).default(3),
  points_draw: z.number().min(0).max(3).default(1),
  points_loss: z.number().min(0).max(2).default(0),
})

const cardsSchema = z.object({
  yellow_cards_for_suspension: z.number().min(1).max(10).default(3),
  red_card_suspension_matches: z.number().min(1).max(5).default(1),
})

// Horário de um dia do torneio: hora de início obrigatória, hora de fim
// prevista opcional. As datas são geradas a partir do intervalo do torneio.
const dailyScheduleEntrySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
    start: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Hora de início obrigatória'),
    end: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Hora de fim inválida')
      .optional()
      .nullable(),
  })
  .refine((d) => !d.end || d.end > d.start, {
    message: 'A hora de fim deve ser depois da hora de início',
    path: ['end'],
  })

export const tiebreakCriterions = [
  'points',
  'head_to_head',
  'goal_difference',
  'goals_scored',
  'goals_conceded',
  'yellow_cards',
  'red_cards',
  'draw',
] as const

export const tiebreakLabels: Record<string, string> = {
  points: 'Pontos',
  head_to_head: 'Confronto directo',
  goal_difference: 'Diferença de golos',
  goals_scored: 'Golos marcados',
  goals_conceded: 'Golos sofridos (menor)',
  yellow_cards: 'Cartões amarelos (menor)',
  red_cards: 'Cartões vermelhos (menor)',
  draw: 'Sorteio',
}

export const tournamentSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(80),
  description: z.string().max(500).optional(),
  visibility: z.enum(['public', 'private']).default('public'),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  match: matchSettingsSchema,
  scoring: scoringSchema,
  cards: cardsSchema,
  tiebreak_order: z.array(z.enum(tiebreakCriterions)).min(1),
  daily_schedule: z.array(dailyScheduleEntrySchema).default([]),
})

export type TournamentInput = z.infer<typeof tournamentSchema>
