// Lógica de geração do bracket de eliminatórias. Funções puras, sem side
// effects e sem dependências do Supabase — totalmente testáveis e partilhadas
// entre a pré-visualização e a Server Action que persiste o bracket.

import type { MatchStatus } from '@/types/database'

// ─── Tipos ────────────────────────────────────────────────────────────────

export interface QualifiedTeam {
  team_id: string
  team_name: string
  team_short_name: string | null
  color_primary: string
  color_secondary: string
  from_group: string // nome do grupo (ex.: "Grupo A")
  position: number // posição no grupo (1, 2, ...)
}

export interface BracketSlot {
  round: number // 1=final, 2=meias, 4=quartos, 8=oitavos
  position: number // posição dentro da ronda (0-indexed)
  home_team: QualifiedTeam | null
  away_team: QualifiedTeam | null
  is_bye: boolean // true se uma equipa avança automaticamente
  next_match_position: number | null // position do jogo seguinte
  next_match_slot: 'home' | 'away' | null
}

export interface BracketRound {
  round: number
  label: string // "Quartos-de-final", "Meias-finais", "Final"
  slots: BracketSlot[]
}

// ─── Rótulos ──────────────────────────────────────────────────────────────

const ROUND_LABELS: Record<number, string> = {
  1: 'Final',
  2: 'Meia-final',
  4: 'Quarto-de-final',
  8: 'Oitavo-de-final',
  16: 'Dezasseis-avos-de-final',
}

/**
 * Rótulo da ronda em português. `round` é o número de jogos da ronda (1=final,
 * 2=meias, 4=quartos, ...), o que basta para determinar o nome.
 */
export function getRoundLabel(round: number): string {
  return ROUND_LABELS[round] ?? `Ronda de ${round * 2}`
}

// Rótulo do jogo de atribuição do 3.º lugar.
export const THIRD_PLACE_LABEL = '3.º e 4.º lugar'

// Posição reservada ao jogo de 3.º/4.º lugar dentro da ronda final. A final
// ocupa a posição 0; o jogo de 3.º lugar (disputado pelos perdedores das
// meias-finais) ocupa a posição 1, distinguindo-o sem colunas adicionais na BD.
export const THIRD_PLACE_POSITION = 1

/**
 * Verdadeiro se o jogo (identificado por ronda + posição) é o jogo de 3.º/4.º
 * lugar: vive na ronda da final (`round === 1`) mas na posição reservada.
 */
export function isThirdPlaceMatch(
  round: number | null,
  position: number | null
): boolean {
  return round === 1 && position === THIRD_PLACE_POSITION
}

// ─── Cálculos de dimensão ───────────────────────────────────────────────────

/**
 * Número de rondas para N equipas — arredonda para a próxima potência de 2.
 * Ex.: 6 equipas → 3 rondas (8 slots, 2 byes).
 */
export function calculateRounds(teamCount: number): number {
  if (teamCount < 2) return 0
  return Math.ceil(Math.log2(teamCount))
}

/**
 * Número de slots na primeira ronda (potência de 2 >= teamCount).
 */
export function calculateFirstRoundSize(teamCount: number): number {
  return 2 ** calculateRounds(teamCount)
}

// ─── Navegação no bracket ───────────────────────────────────────────────────

/**
 * Position do jogo seguinte: dois jogos consecutivos alimentam o mesmo pai.
 */
export function getNextMatchPosition(position: number): number {
  return Math.floor(position / 2)
}

/**
 * Slot do vencedor no jogo seguinte: position par → 'home', ímpar → 'away'.
 */
export function getNextMatchSlot(position: number): 'home' | 'away' {
  return position % 2 === 0 ? 'home' : 'away'
}

// ─── Seeding ────────────────────────────────────────────────────────────────

// Ordem de seeds (1..n) de um bracket de tamanho n (potência de 2). Garante que
// o seed 1 enfrenta o n, o 2 enfrenta o n-1, etc., e que seeds fortes ficam em
// metades opostas. Gerada recursivamente: [1,2] → [1,4,2,3] → [1,8,4,5,2,7,3,6].
function seedOrder(size: number): number[] {
  let seeds = [1, 2]
  while (seeds.length < size) {
    const sum = seeds.length * 2 + 1
    const next: number[] = []
    for (const s of seeds) {
      next.push(s)
      next.push(sum - s)
    }
    seeds = next
  }
  return seeds
}

/**
 * Cruzamentos da primeira ronda. As equipas são ordenadas por posição no grupo
 * (1.os classificados primeiro, depois 2.os, ...), preservando a ordem dos
 * grupos dentro de cada posição. O seeding standard cruza seeds fortes com
 * fracos, o que coloca 1.º de um grupo contra 2.º de outro — evitando, no caso
 * comum de 2 ou 4 grupos, que equipas do mesmo grupo se encontrem na 1.ª ronda.
 * Slots em falta (teamCount não é potência de 2) ficam a `null` → byes.
 */
export function generateFirstRoundMatchups(
  teams: QualifiedTeam[]
): Array<{ home: QualifiedTeam | null; away: QualifiedTeam | null }> {
  const size = calculateFirstRoundSize(teams.length)

  // Ordem estável por posição: 1.os, depois 2.os, ... (mantém a ordem do grupo).
  const seeded = [...teams].sort((a, b) => a.position - b.position)
  const padded: Array<QualifiedTeam | null> = [...seeded]
  while (padded.length < size) padded.push(null)

  const order = seedOrder(size)
  const matchups: Array<{ home: QualifiedTeam | null; away: QualifiedTeam | null }> = []
  for (let k = 0; k < size / 2; k++) {
    const homeSeed = order[2 * k]
    const awaySeed = order[2 * k + 1]
    matchups.push({
      home: padded[homeSeed - 1] ?? null,
      away: padded[awaySeed - 1] ?? null,
    })
  }
  return matchups
}

// ─── Geração do bracket ─────────────────────────────────────────────────────

/**
 * Gera a estrutura completa do bracket a partir das equipas apuradas. As rondas
 * são devolvidas do maior round para o menor (ex.: quartos → meias → final).
 * A primeira ronda fica preenchida com os cruzamentos; as seguintes ficam com
 * slots vazios (a preencher com os vencedores) mas já com os ponteiros para o
 * jogo seguinte calculados.
 */
export function generateBracket(teams: QualifiedTeam[]): BracketRound[] {
  const numRounds = calculateRounds(teams.length)
  if (numRounds === 0) return []

  const size = calculateFirstRoundSize(teams.length)
  const firstRound = size / 2
  const matchups = generateFirstRoundMatchups(teams)

  const buildSlot = (round: number, position: number): BracketSlot => ({
    round,
    position,
    home_team: null,
    away_team: null,
    is_bye: false,
    next_match_position: round === 1 ? null : getNextMatchPosition(position),
    next_match_slot: round === 1 ? null : getNextMatchSlot(position),
  })

  const rounds: BracketRound[] = [
    {
      round: firstRound,
      label: getRoundLabel(firstRound),
      slots: matchups.map((m, position) => ({
        ...buildSlot(firstRound, position),
        home_team: m.home,
        away_team: m.away,
        // Bye: exactamente uma das equipas está presente — avança sozinha.
        is_bye: (m.home === null) !== (m.away === null),
      })),
    },
  ]

  for (let round = firstRound / 2; round >= 1; round /= 2) {
    rounds.push({
      round,
      label: getRoundLabel(round),
      slots: Array.from({ length: round }, (_, position) => buildSlot(round, position)),
    })
  }

  return rounds
}

// ─── Resultado ──────────────────────────────────────────────────────────────

// Forma mínima de um jogo necessária para determinar o vencedor.
export interface BracketScore {
  status: MatchStatus
  home_team_id: string | null
  away_team_id: string | null
  home_score: number
  away_score: number
  home_score_extra: number
  away_score_extra: number
  home_penalties: number
  away_penalties: number
}

/**
 * Equipa vencedora de um jogo de eliminatórias, ou `null` se ainda não
 * terminou (ou empate sem desempate). Conta golos do tempo regulamentar +
 * prolongamento e, em caso de empate, a série de penáltis.
 */
export function computeWinner(m: BracketScore): string | null {
  if (m.status !== 'finished') return null
  const home = m.home_score + m.home_score_extra
  const away = m.away_score + m.away_score_extra
  if (home > away) return m.home_team_id
  if (away > home) return m.away_team_id
  if (m.home_penalties > m.away_penalties) return m.home_team_id
  if (m.away_penalties > m.home_penalties) return m.away_team_id
  return null
}
