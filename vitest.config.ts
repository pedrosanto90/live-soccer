import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// O alias '@' aponta para a raiz do projecto (não há pasta src/) — espelha o
// paths do tsconfig.json ("@/*": ["./*"]).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    include: ['__tests__/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'cypress', '.next'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      // Gate de cobertura sobre a lógica de domínio (utils, validações, Server
      // Actions, queries) e os componentes com testes unitários determinísticos
      // (formulários de auth + user-menu). Ficam de fora: clientes Supabase
      // (factories de SSR/cookies), shadcn/ui e componentes pesados de UI
      // (ex.: tournament-form) cuja verificação real vive no Cypress/E2E.
      include: [
        'lib/**',
        'components/auth/**',
        'components/shared/user-menu.tsx',
      ],
      exclude: ['lib/supabase/**'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
