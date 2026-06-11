describe('Gestão de Jogos', () => {
  const tournamentName = `Torneio Jogos ${Date.now()}`

  before(() => {
    // Prepara um torneio com duas equipas e uma fase de eliminatórias (sem
    // grupos) para poder criar jogos manualmente.
    cy.login()
    cy.visit('/tournaments/new')
    cy.get('[data-testid="tournament-name"]').type(tournamentName)
    cy.get('[data-testid="submit-button"]').click()
    cy.url()
      .should('match', /\/tournaments\/[0-9a-f-]+$/)
      .then((url) => {
        Cypress.env('tournamentUrl', url)

        // Duas equipas.
        cy.visit(`${url}/teams/new`)
        cy.get('[data-testid="team-name"]').type('Sporting CP')
        cy.get('[data-testid="submit-button"]').click()
        cy.url().should('match', /\/teams$/)

        cy.visit(`${url}/teams/new`)
        cy.get('[data-testid="team-name"]').type('Benfica')
        cy.get('[data-testid="submit-button"]').click()
        cy.url().should('match', /\/teams$/)

        // Uma fase de eliminatórias.
        cy.visit(`${url}/phases`)
        cy.get('[data-testid="add-phase"]').click()
        cy.get('[data-testid="phase-type-knockout"]').click()
        cy.get('[data-testid="phase-name"]').clear().type('Final')
        cy.get('[data-testid="phase-submit"]').click()
        cy.contains('[data-testid="phase-card"]', 'Final').should('be.visible')
      })
  })

  beforeEach(() => {
    cy.login()
  })

  function matchesUrl() {
    return `${Cypress.env('tournamentUrl')}/matches`
  }

  it('mostra o empty state quando não há jogos', () => {
    cy.visit(matchesUrl())
    cy.contains('Ainda não há jogos').should('be.visible')
  })

  it('cria um jogo manual', () => {
    cy.visit(matchesUrl())
    cy.get('[data-testid="add-match"]').click()
    cy.url().should('include', '/matches/new')

    cy.get('[data-testid="match-phase"]').click()
    cy.contains('Final').click()

    cy.get('[data-testid="match-home-team"]').click()
    cy.contains('Sporting CP').click()
    cy.get('[data-testid="match-away-team"]').click()
    cy.contains('Benfica').click()

    cy.get('[data-testid="match-submit"]').click()

    cy.url().should('match', /\/matches$/)
    cy.contains('[data-testid="match-row"]', 'Sporting CP').should('be.visible')
    cy.contains('[data-testid="match-row"]', 'Benfica').should('be.visible')
    cy.contains('Por agendar').should('be.visible')
  })

  it('agenda o jogo via dialog', () => {
    cy.visit(matchesUrl())
    cy.contains('[data-testid="match-row"]', 'Sporting CP')
      .find('[data-testid="match-menu"]')
      .click()
    cy.contains('Agendar').click()

    cy.get('[data-testid="schedule-datetime"]').type('2025-06-14T15:30')
    cy.get('[data-testid="schedule-venue"]').type('Pavilhão Municipal')
    cy.get('[data-testid="schedule-submit"]').click()

    cy.contains('[data-testid="match-row"]', 'Pavilhão Municipal').should(
      'be.visible'
    )
    cy.contains('Por agendar').should('not.exist')
  })

  it('entra no detalhe do jogo e abre o painel público', () => {
    cy.visit(matchesUrl())
    cy.contains('[data-testid="match-row"]', 'Sporting CP')
      .find('[aria-label="Detalhe do jogo"]')
      .click()

    cy.url().should('match', /\/matches\/[0-9a-f-]+$/)
    cy.contains('Sporting CP vs Benfica').should('be.visible')

    // O painel público abre numa nova aba; verificamos apenas que o link
    // aponta para a rota pública correcta (sem autenticação).
    cy.contains('a', 'Painel público')
      .should('have.attr', 'target', '_blank')
      .and('have.attr', 'href')
      .and('match', /\/match\/[0-9a-f-]+\/public$/)
  })

  it('apaga o jogo após confirmação', () => {
    cy.visit(matchesUrl())
    cy.contains('[data-testid="match-row"]', 'Sporting CP')
      .find('[data-testid="match-menu"]')
      .click()
    cy.contains('Apagar').click()
    cy.contains('button', 'Apagar jogo').click()

    cy.contains('Ainda não há jogos').should('be.visible')
  })
})
