import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TournamentCard } from '@/components/tournament/tournament-card'
import type { TournamentWithStats } from '@/lib/queries/tournaments'

// As Server Actions e o next/navigation já estão mockados no setup.

const tournament: TournamentWithStats = {
  id: 'tournament-1',
  slug: 'torneio-teste',
  name: 'Torneio de Teste',
  description: null,
  visibility: 'public',
  status: 'draft',
  starts_at: '2025-06-12',
  ends_at: null,
  settings: {} as never,
  created_by: 'user-1',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  stats: { teams: 4, matches: 6, active_matches: 1, finished_matches: 2 },
} as unknown as TournamentWithStats

describe('TournamentCard', () => {
  it('mostra o nome do torneio', () => {
    render(<TournamentCard tournament={tournament} />)
    expect(screen.getByText('Torneio de Teste')).toBeInTheDocument()
  })

  it('mostra o badge de estado (Rascunho)', () => {
    render(<TournamentCard tournament={tournament} />)
    expect(screen.getByText('Rascunho')).toBeInTheDocument()
  })

  it('mostra as estatísticas (equipas, jogos, em curso)', () => {
    render(<TournamentCard tournament={tournament} />)
    expect(screen.getByText('Equipas')).toBeInTheDocument()
    expect(screen.getByText('Jogos')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
  })

  it('mostra a data de início formatada', () => {
    render(<TournamentCard tournament={tournament} />)
    expect(screen.getByText('12 de junho de 2025')).toBeInTheDocument()
  })
})
