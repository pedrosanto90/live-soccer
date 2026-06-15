import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import slugify from "slugify"

import type {
  TournamentSettings,
  TiebreakerCriterion,
  Match,
  MatchPeriod,
  PenaltyKick,
} from "@/types/database"
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

// ---------------------------------------------------------------------------
// Painel de jogo ao vivo
// ---------------------------------------------------------------------------

// Faltas acumuladas de uma equipa na parte actual. Cada parte tem o seu próprio
// contador (as faltas reiniciam ao início de cada parte). O prolongamento
// (extra_first/extra_second) partilha o mesmo contador.
export function getCurrentFouls(
  match: Match,
  side: "home" | "away",
  period: MatchPeriod | null
): number {
  switch (period) {
    case "first_half":
      return side === "home" ? match.home_fouls_h1 : match.away_fouls_h1
    case "second_half":
      return side === "home" ? match.home_fouls_h2 : match.away_fouls_h2
    case "extra_first":
    case "extra_second":
      return side === "home" ? match.home_fouls_extra : match.away_fouls_extra
    default:
      return 0
  }
}

// Coluna de faltas correspondente a uma parte/lado — usada pelas Server Actions
// para incrementar/decrementar o contador certo.
export function foulsColumn(
  side: "home" | "away",
  period: MatchPeriod | null
): keyof Match | null {
  switch (period) {
    case "first_half":
      return side === "home" ? "home_fouls_h1" : "away_fouls_h1"
    case "second_half":
      return side === "home" ? "home_fouls_h2" : "away_fouls_h2"
    case "extra_first":
    case "extra_second":
      return side === "home" ? "home_fouls_extra" : "away_fouls_extra"
    default:
      return null
  }
}

// Etiqueta legível da parte actual.
export function getPeriodLabel(period: MatchPeriod | null): string {
  switch (period) {
    case "first_half":
      return "1.ª parte"
    case "second_half":
      return "2.ª parte"
    case "extra_first":
      return "1.ª parte extra"
    case "extra_second":
      return "2.ª parte extra"
    case "penalties":
      return "Penáltis"
    default:
      return ""
  }
}

// Minuto de jogo de um evento (arredondado para cima, nunca abaixo de 1).
export function formatEventTime(elapsedSecs: number): string {
  const minute = Math.ceil(elapsedSecs / 60)
  return String(minute <= 0 ? 1 : minute)
}

// Determina a próxima equipa a marcar e a ordem do pontapé numa série de
// penáltis. A equipa que começa bate primeiro em cada ronda; a ordem incrementa
// a cada par de pontapés.
//
// Quem começa é definido pelo operador antes do primeiro pontapé (`firstTeamId`,
// por omissão a casa). Assim que existe pelo menos um pontapé, a equipa inicial
// passa a ser derivada do primeiro registado (a lista vem ordenada por
// `created_at`), pelo que a escolha fica trancada e sobrevive a recarregamentos.
export function getNextPenaltyKick(
  kicks: PenaltyKick[],
  homeTeamId: string,
  awayTeamId: string,
  firstTeamId?: string
): { teamId: string; kickOrder: number } {
  const first =
    kicks.length > 0 ? kicks[0].team_id : firstTeamId ?? homeTeamId
  const second = first === homeTeamId ? awayTeamId : homeTeamId

  const firstCount = kicks.filter((k) => k.team_id === first).length
  const secondCount = kicks.filter((k) => k.team_id === second).length

  // A equipa inicial bate primeiro em cada ronda: se já bateu mais (ou igual)
  // que a outra, é a vez da segunda.
  if (firstCount <= secondCount) {
    return { teamId: first, kickOrder: firstCount + 1 }
  }
  return { teamId: second, kickOrder: secondCount + 1 }
}

// Detecta o fim de uma série de penáltis: ou ambas as equipas completaram a
// série regular, ou uma já não pode ser alcançada (vencedor antecipado).
export function isPenaltySeriesComplete(
  kicks: PenaltyKick[],
  totalKicks: number
): boolean {
  const counts = kicks.reduce(
    (acc, k) => {
      const scored = k.scored ? 1 : 0
      if (acc.byTeam[k.team_id] === undefined) {
        acc.byTeam[k.team_id] = { taken: 0, scored: 0 }
      }
      acc.byTeam[k.team_id].taken += 1
      acc.byTeam[k.team_id].scored += scored
      return acc
    },
    { byTeam: {} as Record<string, { taken: number; scored: number }> }
  )

  const teams = Object.values(counts.byTeam)
  if (teams.length < 2) return false

  const [a, b] = teams

  // Vencedor antecipado: a diferença de golos já não pode ser recuperada com os
  // pontapés que faltam a cada equipa dentro da série regular.
  const aRemaining = Math.max(0, totalKicks - a.taken)
  const bRemaining = Math.max(0, totalKicks - b.taken)
  if (a.scored > b.scored + bRemaining) return true
  if (b.scored > a.scored + aRemaining) return true

  // Série regular completa (cada equipa bateu `totalKicks`).
  const regularDone = a.taken >= totalKicks && b.taken >= totalKicks
  if (!regularDone) return false

  // Em caso de empate após a série regular, continua-se (morte súbita): só
  // termina quando, com o mesmo número de pontapés, há diferença de golos.
  return a.taken === b.taken && a.scored !== b.scored
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
