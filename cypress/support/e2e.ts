import './commands'

// Ignora erros que não invalidam os testes (hidratação e o "throw" interno do
// redirect do Next).
Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('Hydration')) return false
  if (err.message.includes('NEXT_REDIRECT')) return false
  return undefined
})
