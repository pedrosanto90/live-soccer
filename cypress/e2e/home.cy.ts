describe('Home page', () => {
  beforeEach(() => cy.visit('/'))

  it('mostra a lista de torneios públicos', () => {
    cy.contains('Torneios de Futebol').should('be.visible')
  })

  it('pesquisa por nome filtra os torneios', () => {
    cy.get('input[placeholder="Pesquisar torneios..."]').type('Torneio Cypress')
    cy.url().should('include', 'search=Torneio')
  })

  it('filtro de estado "Activos" actualiza a listagem', () => {
    cy.contains('button', 'Activos').click()
    cy.url().should('include', 'status=active')
  })

  it('clicar num torneio leva para a página pública', () => {
    cy.get('[data-testid="public-tournament-card"]').first().click()
    cy.url().should('match', /\/t\/[a-z0-9-]+/)
  })

  it('utilizador não autenticado vê botões Entrar e Registar', () => {
    cy.contains('Entrar').should('be.visible')
    cy.contains('Registar').should('be.visible')
  })
})

describe('Home page (autenticado)', () => {
  it('utilizador autenticado vê botão Dashboard', () => {
    cy.login()
    cy.visit('/')
    cy.contains('Dashboard').should('be.visible')
  })
})
