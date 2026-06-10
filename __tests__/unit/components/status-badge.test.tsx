import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '@/components/ui/status-badge'

describe('StatusBadge', () => {
  it('renderiza "Activo" para status active', () => {
    render(<StatusBadge status="active" />)
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  it('renderiza "Rascunho" para status draft', () => {
    render(<StatusBadge status="draft" />)
    expect(screen.getByText('Rascunho')).toBeInTheDocument()
  })

  it('renderiza "Em curso" para status in_progress', () => {
    render(<StatusBadge status="in_progress" />)
    expect(screen.getByText('Em curso')).toBeInTheDocument()
  })

  it('renderiza "Terminado" para status finished', () => {
    render(<StatusBadge status="finished" />)
    expect(screen.getByText('Terminado')).toBeInTheDocument()
  })

  it('renderiza "Cancelado" para status cancelled', () => {
    render(<StatusBadge status="cancelled" />)
    expect(screen.getByText('Cancelado')).toBeInTheDocument()
  })
})
