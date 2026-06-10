import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UserMenu } from '@/components/shared/user-menu'
import type { Profile } from '@/types/database'

function profile(overrides: Partial<Profile>): Profile {
  return {
    id: 'user-1',
    name: 'João Costa',
    avatar_url: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  } as Profile
}

describe('UserMenu', () => {
  it('não renderiza nada quando não há perfil', () => {
    const { container } = render(<UserMenu profile={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra o nome e as iniciais (nome composto)', () => {
    render(<UserMenu profile={profile({ name: 'João Costa' })} />)
    expect(screen.getByText('João Costa')).toBeInTheDocument()
    expect(screen.getByText('JC')).toBeInTheDocument()
  })

  it('usa as duas primeiras letras quando o nome tem uma só palavra', () => {
    render(<UserMenu profile={profile({ name: 'Madonna' })} />)
    expect(screen.getByText('MA')).toBeInTheDocument()
  })

  it('mostra "?" quando o nome está vazio', () => {
    render(<UserMenu profile={profile({ name: '' })} />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })
})
