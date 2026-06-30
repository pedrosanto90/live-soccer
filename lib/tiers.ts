// Escalões (tiers): dimensão organizacional fixa das equipas. Constantes e
// helpers partilhados entre validações, queries e componentes. Usar sempre
// `TIER_LABELS[tier]` para apresentar o escalão ao utilizador — nunca o valor
// cru do enum — e respeitar `TIER_ORDER` na ordem de apresentação.

import type { TeamTier } from '@/types/database'

export const TIERS = ['seniors', 'veterans', 'female', 'benjamins'] as const
export type Tier = TeamTier

export const TIER_LABELS: Record<Tier, string> = {
  seniors: 'Seniores',
  veterans: 'Veteranos',
  female: 'Feminino',
  benjamins: 'Benjamins',
}

export const TIER_ORDER: Record<Tier, number> = {
  seniors: 0,
  veterans: 1,
  female: 2,
  benjamins: 3,
}

// Ordena escalões pela ordem definida em TIER_ORDER.
export function sortTiers(tiers: Tier[]): Tier[] {
  return [...tiers].sort((a, b) => TIER_ORDER[a] - TIER_ORDER[b])
}

// Obtém os escalões únicos presentes numa lista de equipas, ordenados.
export function getUniqueTiers(teams: { tier: Tier }[]): Tier[] {
  const unique = [...new Set(teams.map((t) => t.tier))]
  return sortTiers(unique as Tier[])
}
