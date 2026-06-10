import { describe, it, expect } from 'vitest'
import {
  randomDraw,
  seededDraw,
  generateGroupMatches,
  generateGroupNames,
  validateDrawRequirements,
} from '@/lib/draw'

const teams = [
  { id: '1', name: 'Sporting' },
  { id: '2', name: 'Benfica' },
  { id: '3', name: 'Porto' },
  { id: '4', name: 'Braga' },
  { id: '5', name: 'Estoril' },
  { id: '6', name: 'Vitória' },
]

describe('generateGroupNames', () => {
  it('gera nomes correctos', () => {
    expect(generateGroupNames(3)).toEqual(['Grupo A', 'Grupo B', 'Grupo C'])
  })
  it('gera até 26 grupos', () => {
    expect(generateGroupNames(26)).toHaveLength(26)
    expect(generateGroupNames(26)[25]).toBe('Grupo Z')
  })
})

describe('validateDrawRequirements', () => {
  it('válido quando equipas correspondem exactamente', () => {
    expect(validateDrawRequirements(6, 2, 3).valid).toBe(true)
  })
  it('inválido quando equipas insuficientes', () => {
    const result = validateDrawRequirements(5, 2, 3)
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })
  it('inválido quando equipas a mais', () => {
    expect(validateDrawRequirements(7, 2, 3).valid).toBe(false)
  })
})

describe('randomDraw', () => {
  it('distribui todas as equipas pelos grupos', () => {
    const groups = randomDraw(teams, 2, 3, ['Grupo A', 'Grupo B'])
    expect(groups).toHaveLength(2)
    expect(groups[0].teams).toHaveLength(3)
    expect(groups[1].teams).toHaveLength(3)
    const allTeamIds = groups.flatMap((g) => g.teams.map((t) => t.id))
    expect(allTeamIds.sort()).toEqual(teams.map((t) => t.id).sort())
  })

  it('não repete equipas entre grupos', () => {
    const groups = randomDraw(teams, 2, 3, ['Grupo A', 'Grupo B'])
    const allIds = groups.flatMap((g) => g.teams.map((t) => t.id))
    const uniqueIds = new Set(allIds)
    expect(uniqueIds.size).toBe(allIds.length)
  })

  it('lança erro se equipas insuficientes', () => {
    expect(() => randomDraw(teams.slice(0, 4), 2, 3, ['A', 'B'])).toThrow()
  })
})

describe('seededDraw', () => {
  const seeds = [teams[0], teams[1]] // Sporting e Benfica como cabeças de série

  it('coloca cada cabeça de série no grupo correspondente', () => {
    const groups = seededDraw(teams, seeds, 2, 3, ['Grupo A', 'Grupo B'])
    expect(groups[0].teams[0].id).toBe(teams[0].id) // seed no primeiro lugar
    expect(groups[1].teams[0].id).toBe(teams[1].id)
  })

  it('distribui as restantes equipas pelos grupos', () => {
    const groups = seededDraw(teams, seeds, 2, 3, ['Grupo A', 'Grupo B'])
    expect(groups[0].teams).toHaveLength(3)
    expect(groups[1].teams).toHaveLength(3)
  })

  it('não repete equipas', () => {
    const groups = seededDraw(teams, seeds, 2, 3, ['Grupo A', 'Grupo B'])
    const allIds = groups.flatMap((g) => g.teams.map((t) => t.id))
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('lança erro se o nº de cabeças de série não bate com o nº de grupos', () => {
    expect(() => seededDraw(teams, seeds, 3, 2, ['A', 'B', 'C'])).toThrow()
  })
})

describe('generateGroupMatches', () => {
  it('gera o número correcto de jogos para 3 equipas (round-robin)', () => {
    // 3 equipas → 3 jogos (3*2/2 = 3)
    const groups = [{ name: 'Grupo A', teams: teams.slice(0, 3) }]
    const matches = generateGroupMatches(groups)
    expect(matches).toHaveLength(3)
  })

  it('gera o número correcto de jogos para 4 equipas', () => {
    // 4 equipas → 6 jogos (4*3/2 = 6)
    const groups = [{ name: 'Grupo A', teams: teams.slice(0, 4) }]
    const matches = generateGroupMatches(groups)
    expect(matches).toHaveLength(6)
  })

  it('cada par de equipas joga exactamente uma vez', () => {
    const groups = [{ name: 'Grupo A', teams: teams.slice(0, 4) }]
    const matches = generateGroupMatches(groups)
    const pairs = matches.map((m) =>
      [m.home_team_id, m.away_team_id].sort().join('-')
    )
    expect(new Set(pairs).size).toBe(pairs.length)
  })

  it('gera jogos para múltiplos grupos', () => {
    const groups = [
      { name: 'Grupo A', teams: teams.slice(0, 3) },
      { name: 'Grupo B', teams: teams.slice(3, 6) },
    ]
    const matches = generateGroupMatches(groups)
    expect(matches).toHaveLength(6) // 3 + 3
  })

  it('atribui o group_index correcto a cada jogo', () => {
    const groups = [
      { name: 'Grupo A', teams: teams.slice(0, 3) },
      { name: 'Grupo B', teams: teams.slice(3, 6) },
    ]
    const matches = generateGroupMatches(groups)
    expect(matches.filter((m) => m.group_index === 0)).toHaveLength(3)
    expect(matches.filter((m) => m.group_index === 1)).toHaveLength(3)
  })

  it('nenhum jogo tem a mesma equipa em casa e fora', () => {
    const groups = [{ name: 'Grupo A', teams: teams.slice(0, 4) }]
    const matches = generateGroupMatches(groups)
    matches.forEach((m) => {
      expect(m.home_team_id).not.toBe(m.away_team_id)
    })
  })
})
