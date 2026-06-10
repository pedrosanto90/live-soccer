import { z } from 'zod'

// Schemas de autenticação reutilizados pelas Server Actions e pelos
// formulários client-side (react-hook-form).

export const signInSchema = z.object({
  email: z.email('Email inválido'),
  password: z.string().min(1, 'Introduz a tua password'),
})

export const signUpSchema = z.object({
  name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  email: z.email('Email inválido'),
  password: z.string().min(6, 'A password deve ter pelo menos 6 caracteres'),
})

// Schema do formulário de registo: acrescenta a confirmação de password,
// validada apenas no cliente.
export const registerFormSchema = signUpSchema
  .extend({
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As passwords não coincidem',
    path: ['confirmPassword'],
  })

export type SignInInput = z.infer<typeof signInSchema>
export type SignUpInput = z.infer<typeof signUpSchema>
export type RegisterFormInput = z.infer<typeof registerFormSchema>
