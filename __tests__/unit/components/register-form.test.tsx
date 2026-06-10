import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/lib/actions/auth', () => ({
  signUp: vi.fn().mockResolvedValue({ success: false, error: 'Erro' }),
}))

import { RegisterForm } from '@/components/auth/register-form'
import { signUp } from '@/lib/actions/auth'

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza todos os campos', () => {
    render(<RegisterForm />)
    expect(screen.getByTestId('name-input')).toBeInTheDocument()
    expect(screen.getByTestId('email-input')).toBeInTheDocument()
    expect(screen.getByTestId('password-input')).toBeInTheDocument()
    expect(screen.getByTestId('confirm-password-input')).toBeInTheDocument()
  })

  it('chama signUp sem o confirmPassword quando os dados são válidos', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(screen.getByTestId('name-input'), 'João Costa')
    await user.type(screen.getByTestId('email-input'), 'joao@example.com')
    await user.type(screen.getByTestId('password-input'), 'secret123')
    await user.type(screen.getByTestId('confirm-password-input'), 'secret123')
    await user.click(screen.getByTestId('submit-button'))

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith({
        name: 'João Costa',
        email: 'joao@example.com',
        password: 'secret123',
      })
    )
  })

  it('mostra erro e não submete quando as passwords não coincidem', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(screen.getByTestId('name-input'), 'João')
    await user.type(screen.getByTestId('email-input'), 'joao@example.com')
    await user.type(screen.getByTestId('password-input'), 'secret123')
    await user.type(screen.getByTestId('confirm-password-input'), 'diferente')
    await user.click(screen.getByTestId('submit-button'))

    expect(await screen.findByText('As passwords não coincidem')).toBeInTheDocument()
    expect(signUp).not.toHaveBeenCalled()
  })
})
