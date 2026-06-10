describe('Gestão de Equipas e Jogadores', () => {
  const tournamentName = `Torneio Equipas ${Date.now()}`

  before(() => {
    // Cria um torneio dedicado a esta spec e guarda o seu URL.
    cy.login()
    cy.visit('/tournaments/new')
    cy.get('[data-testid="tournament-name"]').type(tournamentName)
    cy.get('[data-testid="submit-button"]').click()
    cy.url()
      .should('match', /\/tournaments\/[0-9a-f-]+$/)
      .then((url) => {
        Cypress.env('tournamentUrl', url)
      })
  })

  beforeEach(() => {
    cy.login()
  })

  function teamsUrl() {
    return `${Cypress.env('tournamentUrl')}/teams`
  }

  it('mostra o empty state quando não há equipas', () => {
    cy.visit(teamsUrl())
    cy.contains('Ainda não há equipas').should('be.visible')
  })

  it('cria uma equipa com preview de cores', () => {
    cy.visit(teamsUrl())
    cy.get('[data-testid="add-team"]').click()
    cy.url().should('include', '/teams/new')

    cy.get('[data-testid="team-name"]').type('Sporting CP')
    cy.get('[data-testid="team-short-name"]').type('SCP')
    cy.get('[data-testid="submit-button"]').click()

    cy.url().should('match', /\/teams$/)
    cy.contains('[data-testid="team-card"]', 'Sporting CP').should('be.visible')
  })

  it('edita a equipa criada', () => {
    cy.visit(teamsUrl())
    cy.contains('[data-testid="team-card"]', 'Sporting CP')
      .find('[data-testid="team-menu"]')
      .click()
    cy.contains('Editar').click()
    cy.url().should('include', '/edit')

    cy.get('[data-testid="team-name"]').should('have.value', 'Sporting CP')
    cy.get('[data-testid="team-name"]').clear().type('Sporting Clube de Portugal')
    cy.get('[data-testid="submit-button"]').click()

    cy.url().should('match', /\/teams$/)
    cy.contains('[data-testid="team-card"]', 'Sporting Clube de Portugal').should(
      'be.visible'
    )
  })

  it('adiciona um jogador via dialog', () => {
    cy.visit(teamsUrl())
    cy.contains('[data-testid="team-card"]', 'Sporting Clube de Portugal').click()
    cy.url().should('match', /\/teams\/[0-9a-f-]+$/)

    cy.contains('Sem jogadores').should('be.visible')
    cy.get('[data-testid="add-player"]').click()

    cy.get('[data-testid="player-name"]').type('João Silva')
    cy.get('[data-testid="player-number"]').type('10')
    cy.get('[data-testid="player-submit"]').click()

    cy.contains('[data-testid="player-row"]', 'João Silva').should('be.visible')
  })

  it('edita o jogador', () => {
    cy.contains('[data-testid="player-row"]', 'João Silva')
      .find('[data-testid="player-menu"]')
      .click()
    cy.contains('Editar').click()

    cy.get('[data-testid="player-name"]').should('have.value', 'João Silva')
    cy.get('[data-testid="player-name"]').clear().type('João Pedro Silva')
    cy.get('[data-testid="player-submit"]').click()

    cy.contains('[data-testid="player-row"]', 'João Pedro Silva').should(
      'be.visible'
    )
  })

  it('remove o jogador após confirmação', () => {
    cy.contains('[data-testid="player-row"]', 'João Pedro Silva')
      .find('[data-testid="player-menu"]')
      .click()
    cy.contains('Remover').click()
    cy.contains('button', 'Remover').click()

    cy.contains('João Pedro Silva').should('not.exist')
  })

  it('apaga a equipa após confirmação', () => {
    cy.visit(teamsUrl())
    cy.contains('[data-testid="team-card"]', 'Sporting Clube de Portugal')
      .find('[data-testid="team-menu"]')
      .click()
    cy.contains('Apagar').click()
    cy.contains('button', 'Apagar equipa').click()

    cy.contains('Sporting Clube de Portugal').should('not.exist')
  })
})
