import '@testing-library/cypress/add-commands'

// Comando de login reutilizável, com cache de sessão entre specs.
Cypress.Commands.add('login', (email?: string, password?: string) => {
  const user = email ?? Cypress.env('TEST_USER_EMAIL')
  const pass = password ?? Cypress.env('TEST_USER_PASSWORD')

  cy.session(
    user,
    () => {
      cy.visit('/login')
      cy.get('[data-testid="email-input"]').type(user)
      cy.get('[data-testid="password-input"]').type(pass, { log: false })
      cy.get('[data-testid="submit-button"]').click()
      cy.url().should('include', '/dashboard')
    },
    { cacheAcrossSpecs: true }
  )
})

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      login(email?: string, password?: string): Chainable<void>
    }
  }
}

export {}
