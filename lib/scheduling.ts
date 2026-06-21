// Agendamento automático de jogos a partir do horário diário do torneio.
// Funções puras, sem side effects e sem dependências do Supabase — partilhadas
// pelo sorteio da fase de grupos e pela geração do bracket de eliminatórias.

import type { TournamentSettings } from '@/types/database'

// Folga (em minutos) entre o fim previsto de um jogo e o início do seguinte.
export const MATCH_GAP_MINUTES = 10

// Duração assumida de um jogo quando o torneio não tem settings de jogo: dois
// tempos de 20 min + 5 min de intervalo.
const DEFAULT_MATCH_DURATION_MINUTES = 45

export interface ScheduleDay {
  date: string // YYYY-MM-DD
  start: string // HH:mm
  end: string | null // HH:mm previsto (opcional)
}

/**
 * Duração prevista de um jogo: dois tempos + o intervalo entre eles. É a base do
 * passo de agendamento (a que se soma a folga entre jogos).
 */
export function matchDurationMinutes(
  match?: TournamentSettings['match'] | null
): number {
  if (!match) return DEFAULT_MATCH_DURATION_MINUTES
  return match.half_duration_minutes * 2 + match.half_time_duration_minutes
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

const pad = (n: number) => String(n).padStart(2, '0')

// Constrói um timestamp "naive" (sem timezone), no mesmo formato que o resto da
// app usa para `scheduled_at` (ver <input type="datetime-local"> em match-form):
// 'YYYY-MM-DDTHH:mm:00'. A aritmética é feita em UTC só para evitar o fuso do
// servidor — o valor final é interpretado como hora local, como em toda a app.
function localTimestamp(date: string, minutes: number): string {
  const [y, mo, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, mo - 1, d) + minutes * 60_000)
  return (
    `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}` +
    `T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:00`
  )
}

/**
 * Gera horários sequenciais para `total` jogos a partir do horário diário do
 * torneio. Cada jogo ocupa `durationMinutes` e é seguido de `gapMinutes` de
 * folga antes do próximo.
 *
 * Regras:
 * - Os dias são percorridos por ordem cronológica, a partir da respectiva hora
 *   de início.
 * - Quando um jogo já não cabe antes da hora de fim de um dia, passa para o dia
 *   seguinte.
 * - O último dia transborda (ignora a hora de fim) para garantir que todos os
 *   jogos ficam agendados; o mesmo se aplica a dias sem hora de fim, que
 *   absorvem os jogos restantes.
 *
 * Devolve `[]` se não houver horário definido (jogos ficam sem hora).
 */
export function buildMatchSlots(
  days: ScheduleDay[],
  durationMinutes: number,
  gapMinutes: number,
  total: number
): string[] {
  if (total <= 0) return []

  const sorted = days
    .filter((d) => d.date && d.start)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  if (sorted.length === 0) return []

  const step = durationMinutes + gapMinutes
  const slots: string[] = []

  for (let di = 0; di < sorted.length && slots.length < total; di++) {
    const day = sorted[di]
    const endMin = day.end ? toMinutes(day.end) : null
    const isLast = di === sorted.length - 1
    let cursor = toMinutes(day.start)

    while (slots.length < total) {
      const fits = endMin === null || cursor + durationMinutes <= endMin
      // Em dias intermédios, quando o jogo já não cabe antes do fim, avança para
      // o dia seguinte. No último dia (ou em dias sem fim) deixa transbordar.
      if (!fits && !isLast) break
      slots.push(localTimestamp(day.date, cursor))
      cursor += step
    }
  }

  return slots
}
