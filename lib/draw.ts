// Lógica de sorteio e geração de jogos. Funções puras, sem side effects e sem
// dependências do Supabase — totalmente testáveis e reutilizáveis tanto na
// pré-visualização client-side como na Server Action que persiste o sorteio.

// ─── Tipos ────────────────────────────────────────────────────────────────

export interface Team {
  id: string
  name: string
}

export interface DrawGroup {
  name: string
  teams: Team[]
}

export interface GeneratedMatch {
  home_team_id: string
  away_team_id: string
  group_index: number
}

// ─── Utilitários ──────────────────────────────────────────────────────────

// Baralha uma cópia do array (Fisher–Yates). Não muta o original.
function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ─── Geração de nomes de grupos ───────────────────────────────────────────

/**
 * Gera nomes de grupos: "Grupo A", "Grupo B", ... "Grupo Z".
 */
export function generateGroupNames(count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => `Grupo ${String.fromCharCode(65 + i)}`
  )
}

// ─── Validações ───────────────────────────────────────────────────────────

/**
 * Valida se há equipas suficientes (e exactamente as necessárias) para o
 * sorteio. O sorteio exige que o nº de equipas seja igual a
 * `numGroups * teamsPerGroup`.
 */
export function validateDrawRequirements(
  totalTeams: number,
  numGroups: number,
  teamsPerGroup: number
): { valid: boolean; error?: string } {
  if (numGroups < 1) {
    return { valid: false, error: 'É necessário pelo menos um grupo.' }
  }
  if (teamsPerGroup < 2) {
    return { valid: false, error: 'Cada grupo precisa de pelo menos duas equipas.' }
  }

  const required = numGroups * teamsPerGroup
  if (totalTeams < required) {
    return {
      valid: false,
      error: `São necessárias ${required} equipas, mas só há ${totalTeams} inscritas.`,
    }
  }
  if (totalTeams > required) {
    return {
      valid: false,
      error: `Há ${totalTeams} equipas para ${required} lugares. Ajusta o nº de grupos ou de equipas por grupo.`,
    }
  }
  return { valid: true }
}

// ─── Sorteio aleatório ────────────────────────────────────────────────────

/**
 * Distribui as equipas aleatoriamente pelos grupos. Garante que cada grupo tem
 * exactamente `teamsPerGroup` equipas. Lança erro se
 * `teams.length !== numGroups * teamsPerGroup`.
 */
export function randomDraw(
  teams: Team[],
  numGroups: number,
  teamsPerGroup: number,
  groupNames: string[]
): DrawGroup[] {
  const required = numGroups * teamsPerGroup
  if (teams.length !== required) {
    throw new Error(
      `Número de equipas (${teams.length}) não corresponde a ${numGroups} grupos × ${teamsPerGroup} equipas.`
    )
  }

  const groups: DrawGroup[] = Array.from({ length: numGroups }, (_, i) => ({
    name: groupNames[i] ?? `Grupo ${i + 1}`,
    teams: [],
  }))

  shuffle(teams).forEach((team, idx) => {
    groups[Math.floor(idx / teamsPerGroup)].teams.push(team)
  })

  return groups
}

// ─── Sorteio com cabeças de série ─────────────────────────────────────────

/**
 * Distribui com cabeças de série:
 * - `seeds[i]` vai directamente para o grupo `i` (no primeiro lugar).
 * - As restantes equipas são sorteadas aleatoriamente pelos grupos.
 * - Garante que cada grupo tem exactamente uma cabeça de série.
 * Lança erro se `seeds.length !== numGroups` ou se o total não fechar.
 */
export function seededDraw(
  teams: Team[],
  seeds: Team[],
  numGroups: number,
  teamsPerGroup: number,
  groupNames: string[]
): DrawGroup[] {
  if (seeds.length !== numGroups) {
    throw new Error(
      `Número de cabeças de série (${seeds.length}) tem de ser igual ao número de grupos (${numGroups}).`
    )
  }

  const required = numGroups * teamsPerGroup
  if (teams.length !== required) {
    throw new Error(
      `Número de equipas (${teams.length}) não corresponde a ${numGroups} grupos × ${teamsPerGroup} equipas.`
    )
  }

  const seedIds = new Set(seeds.map((s) => s.id))
  if (seedIds.size !== seeds.length) {
    throw new Error('Cada cabeça de série tem de ser uma equipa distinta.')
  }

  const groups: DrawGroup[] = Array.from({ length: numGroups }, (_, i) => ({
    name: groupNames[i] ?? `Grupo ${i + 1}`,
    teams: [seeds[i]],
  }))

  // As restantes equipas distribuídas igualmente — (teamsPerGroup - 1) por grupo.
  const perGroupRest = teamsPerGroup - 1
  const rest = shuffle(teams.filter((t) => !seedIds.has(t.id)))
  groups.forEach((group, i) => {
    group.teams.push(...rest.slice(i * perGroupRest, (i + 1) * perGroupRest))
  })

  return groups
}

// ─── Geração de jogos (round-robin) ──────────────────────────────────────

/**
 * Gera todos os jogos de cada grupo pelo algoritmo round-robin (método do
 * círculo / Berger). Para N equipas gera N*(N-1)/2 jogos únicos — cada par
 * joga exactamente uma vez. O `group_index` corresponde ao índice do grupo no
 * array recebido.
 */
export function generateGroupMatches(groups: DrawGroup[]): GeneratedMatch[] {
  const matches: GeneratedMatch[] = []

  groups.forEach((group, groupIndex) => {
    // Para N ímpar adiciona-se um "bye" (null) que folga a cada jornada.
    const roster: (Team | null)[] =
      group.teams.length % 2 === 0 ? [...group.teams] : [...group.teams, null]

    const n = roster.length
    if (n < 2) return

    const rounds = n - 1
    const half = n / 2
    let arr = [...roster]

    for (let r = 0; r < rounds; r++) {
      for (let i = 0; i < half; i++) {
        const home = arr[i]
        const away = arr[n - 1 - i]
        if (home && away) {
          matches.push({
            home_team_id: home.id,
            away_team_id: away.id,
            group_index: groupIndex,
          })
        }
      }
      // Roda mantendo o primeiro fixo: [a0, an-1, a1, a2, ..., an-2].
      arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)]
    }
  })

  return matches
}
