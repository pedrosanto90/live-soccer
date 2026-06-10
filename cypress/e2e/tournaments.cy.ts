describe('Gestão de Torneios', () => {
  beforeEach(() => {
    cy.login()
  })

  it('navega para o formulário de criação a partir do dashboard', () => {
    cy.visit('/dashboard')
    // O botão "Criar torneio" existe no header e no empty state.
    cy.contains('Criar torneio').first().click()
    cy.url().should('include', '/tournaments/new')
  })

  it('cria um torneio com as informações básicas', () => {
    cy.visit('/tournaments/new')

    cy.get('[data-testid="tournament-name"]').type('Torneio Cypress 2025')
    cy.get('[data-testid="tournament-description"]').type(
      'Torneio criado por teste automatizado'
    )

    // Os restantes campos têm defaults — submeter directamente.
    cy.get('[data-testid="submit-button"]').click()

    // Redireccionado para o overview do torneio (/tournaments/<id>).
    cy.url().should('match', /\/tournaments\/[0-9a-f-]+$/)
    cy.contains('Torneio Cypress 2025').should('be.visible')
  })

  it('mostra o torneio criado no dashboard', () => {
    cy.visit('/dashboard')
    cy.contains('Torneio Cypress 2025').should('be.visible')
  })

  it('navega para a edição do torneio', () => {
    cy.visit('/dashboard')
    cy.contains('Torneio Cypress 2025')
      .closest('[data-testid="tournament-card"]')
      .find('[data-testid="tournament-menu"]')
      .click()
    cy.contains('Editar').click()
    cy.url().should('include', '/edit')
    cy.get('[data-testid="tournament-name"]').should(
      'have.value',
      'Torneio Cypress 2025'
    )
  })

  it('apaga um torneio em rascunho após confirmação', () => {
    cy.visit('/dashboard')
    cy.contains('Torneio Cypress 2025')
      .closest('[data-testid="tournament-card"]')
      .find('[data-testid="tournament-menu"]')
      .click()
    cy.contains('Apagar').click()
    // Botão de confirmação no AlertDialog.
    cy.contains('button', 'Apagar torneio').click()
    cy.contains('Torneio Cypress 2025').should('not.exist')
  })
})
