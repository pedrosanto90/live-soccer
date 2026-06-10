import { defineConfig } from 'cypress'

// O Cypress lê automaticamente variáveis de ambiente prefixadas com CYPRESS_
// do shell (ex.: CYPRESS_TEST_USER_EMAIL → Cypress.env('TEST_USER_EMAIL')).
// Os defaults abaixo são apenas para conveniência em desenvolvimento local.
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: 'cypress/fixtures',
    video: false,
    screenshotOnRunFailure: true,
    viewportWidth: 1280,
    viewportHeight: 720,
    env: {
      TEST_USER_EMAIL: 'test@futsal-manager.dev',
      TEST_USER_PASSWORD: 'testpassword123',
    },
  },
})
