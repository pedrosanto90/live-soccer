import { z } from 'zod'

// Schemas de validação de jogos, partilhados entre as Server Actions e os
// formulários client-side (react-hook-form).

// Override das configurações do torneio ao nível do jogo. Só o subconjunto
// `match` é editável por jogo — as restantes secções herdam sempre do torneio.
const matchSettingsOverrideSchema = z
  .object({
    match: z
      .object({
        half_duration_minutes: z.number().min(5).max(45),
        half_time_duration_minutes: z.number().min(1).max(20),
        extra_time_duration_minutes: z.number().min(1).max(20),
        max_fouls_per_team_per_half: z.number().min(1).max(10),
        penalty_shootout_kicks: z.number().min(3).max(10),
      })
      .partial()
      .optional(),
  })
  .optional()
  .nullable()

export const matchSchema = z
  .object({
    phase_id: z.string().uuid('Fase obrigatória'),
    group_id: z.string().uuid().optional().nullable(),
    home_team_id: z.string().uuid('Equipa da casa obrigatória'),
    away_team_id: z.string().uuid('Equipa de fora obrigatória'),
    referee_id: z.string().uuid().optional().nullable(),
    venue: z.string().max(100).optional().nullable(),
    scheduled_at: z.string().optional().nullable(),
    settings_override: matchSettingsOverrideSchema,
  })
  .refine((data) => data.home_team_id !== data.away_team_id, {
    message: 'As equipas não podem ser iguais',
    path: ['away_team_id'],
  })

export const scheduleMatchSchema = z.object({
  venue: z.string().max(100).optional().nullable(),
  scheduled_at: z.string().optional().nullable(),
  referee_id: z.string().uuid().optional().nullable(),
})

export type MatchInput = z.infer<typeof matchSchema>
export type ScheduleMatchInput = z.infer<typeof scheduleMatchSchema>
