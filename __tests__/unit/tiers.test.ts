import { describe, it, expect } from 'vitest'

import {
  sortTiers,
  getUniqueTiers,
  TIER_LABELS,
  TIERS,
} from '@/lib/tiers'

describe('sortTiers', () => {
  it('ordena escalões pela ordem definida', () => {
    const sorted = sortTiers(['benjamins', 'seniors', 'female'])
    expect(sorted).toEqual(['seniors', 'female', 'benjamins'])
  })

  it('não altera array já ordenado', () => {
    const sorted = sortTiers(['seniors', 'veterans', 'female', 'benjamins'])
    expect(sorted).toEqual(['seniors', 'veterans', 'female', 'benjamins'])
  })
})

describe('getUniqueTiers', () => {
  it('retorna escalões únicos ordenados', () => {
    const teams = [
      { tier: 'benjamins' as const },
      { tier: 'seniors' as const },
      { tier: 'seniors' as const },
      { tier: 'female' as const },
    ]
    expect(getUniqueTiers(teams)).toEqual(['seniors', 'female', 'benjamins'])
  })
})

describe('TIER_LABELS', () => {
  it('tem labels para todos os escalões', () => {
    TIERS.forEach((tier) => {
      expect(TIER_LABELS[tier]).toBeDefined()
      expect(TIER_LABELS[tier].length).toBeGreaterThan(0)
    })
  })
})
