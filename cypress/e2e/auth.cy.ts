describe('Autenticação', () => {
  it('redireciona para /dashboard após login com sucesso', () => {
    cy.visit('/login')
    cy.get('[data-testid="email-input"]').type(Cypress.env('TEST_USER_EMAIL'))
    cy.get('[data-testid="password-input"]').type(Cypress.env('TEST_USER_PASSWORD'))
    cy.get('[data-testid="submit-button"]').click()
    cy.url().should('include', '/dashboard')
    cy.contains('Olá,').should('be.visible')
  })

  it('mostra erro com credenciais inválidas', () => {
    cy.visit('/login')
    cy.get('[data-testid="email-input"]').type('wrong@example.com')
    cy.get('[data-testid="password-input"]').type('wrongpassword')
    cy.get('[data-testid="submit-button"]').click()
    cy.contains('Email ou password incorretos').should('be.visible')
    cy.url().should('include', '/login')
  })

  it('redireciona para /login ao aceder a /dashboard sem sessão', () => {
    cy.clearCookies()
    cy.visit('/dashboard')
    cy.url().should('include', '/login')
  })

  it('termina sessão e redireciona para /', () => {
    cy.login()
    cy.visit('/dashboard')
    cy.get('[data-testid="user-menu-trigger"]').click()
    cy.contains('Terminar sessão').click()
    cy.url().should('eq', Cypress.config('baseUrl') + '/')
  })
})
