import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock da action — só queremos verificar a integração form → action.
vi.mock('@/lib/actions/auth', () => ({
  signIn: vi.fn().mockResolvedValue({
    success: false,
    error: 'Email ou password incorretos.',
  }),
}))

import { LoginForm } from '@/components/auth/login-form'
import { signIn } from '@/lib/actions/auth'
import { toast } from 'sonner'

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza os campos e o botão', () => {
    render(<LoginForm />)
    expect(screen.getByTestId('email-input')).toBeInTheDocument()
    expect(screen.getByTestId('password-input')).toBeInTheDocument()
    expect(screen.getByTestId('submit-button')).toBeInTheDocument()
  })

  it('chama signIn com os valores submetidos', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByTestId('email-input'), 'joao@example.com')
    await user.type(screen.getByTestId('password-input'), 'secret123')
    await user.click(screen.getByTestId('submit-button'))

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith(
        { email: 'joao@example.com', password: 'secret123' },
        undefined
      )
    )
  })

  it('mostra um toast de erro quando a action falha', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByTestId('email-input'), 'joao@example.com')
    await user.type(screen.getByTestId('password-input'), 'secret123')
    await user.click(screen.getByTestId('submit-button'))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Email ou password incorretos.')
    )
  })

  it('não chama signIn quando o email é inválido (validação client-side)', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByTestId('email-input'), 'nao-e-email')
    await user.type(screen.getByTestId('password-input'), 'secret123')
    await user.click(screen.getByTestId('submit-button'))

    // A validação client-side (zodResolver) bloqueia o submit — a action não
    // chega a ser invocada com um email inválido.
    await new Promise((r) => setTimeout(r, 50))
    expect(signIn).not.toHaveBeenCalled()
  })

  it('alterna a visibilidade da password', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    const password = screen.getByTestId('password-input')
    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Mostrar password' }))
    expect(password).toHaveAttribute('type', 'text')
  })
})
