import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import slugify from "slugify"

import type { TournamentSettings, TiebreakerCriterion, Match } from "@/types/database"
import { tiebreakCriterions, type TournamentInput } from "@/lib/validations/tournament"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formata datas para pt-PT: "12 de junho de 2025"
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("pt-PT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
}

// Gera um slug a partir do nome, com sufixo opcional para garantir unicidade.
export function generateSlug(name: string, suffix?: string): string {
  const base = slugify(name, { lower: true, strict: true })
  return suffix ? `${base}-${suffix}` : base
}

// Valores por defeito das configurações de um torneio.
const defaultSettings: TournamentSettings = {
  match: {
    half_duration_minutes: 20,
    half_time_duration_minutes: 5,
    extra_time_duration_minutes: 5,
    max_fouls_per_team_per_half: 5,
    penalty_shootout_kicks: 5,
  },
  scoring: {
    points_win: 3,
    points_draw: 1,
    points_loss: 0,
  },
  cards: {
    yellow_cards_for_suspension: 3,
    red_card_suspension_matches: 1,
  },
  tiebreak_order: [...tiebreakCriterions],
}

type ParsedSettings = Pick<
  TournamentInput,
  "match" | "scoring" | "cards" | "tiebreak_order"
>

// Converte o jsonb da BD para os campos do formulário, com fallbacks nos defaults.
export function parseTournamentSettings(
  settings: unknown
): ParsedSettings {
  const s = (settings ?? {}) as Partial<TournamentSettings>
  return {
    match: { ...defaultSettings.match, ...s.match },
    scoring: { ...defaultSettings.scoring, ...s.scoring },
    cards: { ...defaultSettings.cards, ...s.cards },
    tiebreak_order:
      Array.isArray(s.tiebreak_order) && s.tiebreak_order.length > 0
        ? (s.tiebreak_order as TiebreakerCriterion[])
        : defaultSettings.tiebreak_order,
  }
}

// Converte os campos do formulário para o objecto settings a guardar na BD.
export function buildTournamentSettings(
  values: TournamentInput
): TournamentSettings {
  return {
    match: values.match,
    scoring: values.scoring,
    cards: values.cards,
    tiebreak_order: values.tiebreak_order,
  }
}

// Formata a data/hora de um jogo para pt-PT: "sáb., 14 jun. · 15:30".
export function formatMatchDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return ""
  const parts = new Intl.DateTimeFormat("pt-PT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ""

  const day = `${get("weekday")}, ${get("day")} ${get("month")}`
  const time = `${get("hour")}:${get("minute")}`
  return `${day} · ${time}`
}

// Resultado de um jogo terminado, considerando golos normais + prolongamento
// (os penáltis não contam para a classificação). Devolve null se não terminou.
export function getMatchResult(
  match: Pick<
    Match,
    | "status"
    | "home_score"
    | "away_score"
    | "home_score_extra"
    | "away_score_extra"
  >
): "home" | "away" | "draw" | null {
  if (match.status !== "finished") return null

  const home = match.home_score + (match.home_score_extra ?? 0)
  const away = match.away_score + (match.away_score_extra ?? 0)

  if (home > away) return "home"
  if (away > home) return "away"
  return "draw"
}

// Faz o merge profundo das configurações do torneio com o override do jogo.
// Só as chaves presentes no override sobrepõem as do torneio.
export function getEffectiveSettings(
  tournamentSettings: TournamentSettings,
  override?: Partial<TournamentSettings> | null
): TournamentSettings {
  if (!override) return tournamentSettings

  return {
    match: { ...tournamentSettings.match, ...override.match },
    scoring: { ...tournamentSettings.scoring, ...override.scoring },
    cards: { ...tournamentSettings.cards, ...override.cards },
    tiebreak_order: override.tiebreak_order ?? tournamentSettings.tiebreak_order,
  }
}
