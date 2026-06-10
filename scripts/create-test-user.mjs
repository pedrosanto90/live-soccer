import { createClient } from '@supabase/supabase-js'

// Cria o utilizador usado pelos testes E2E (Cypress) directamente via Admin
// API, com o email confirmado automaticamente. Idempotente.
//
// Correr com as variáveis do .env.local carregadas:
//   node --env-file=.env.local scripts/create-test-user.mjs
// (ver script npm "test:create-user").

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
// Suporta a chave service_role clássica e a nova secret key (sb_secret_...).
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !serviceKey) {
  console.error(
    'Faltam variáveis de ambiente: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SECRET_KEY).'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEST_USER_EMAIL =
  process.env.CYPRESS_TEST_USER_EMAIL ?? 'test@futsal-manager.dev'
const TEST_USER_PASSWORD =
  process.env.CYPRESS_TEST_USER_PASSWORD ?? 'testpassword123'
const TEST_USER_NAME = 'Utilizador de Teste'

async function createTestUser() {
  console.log(`A criar utilizador de teste: ${TEST_USER_EMAIL}`)

  const { data: existing, error: listError } =
    await supabase.auth.admin.listUsers()
  if (listError) {
    console.error('Erro ao listar utilizadores:', listError.message)
    process.exit(1)
  }

  if (existing?.users?.some((u) => u.email === TEST_USER_EMAIL)) {
    console.log('✓ Utilizador de teste já existe — nada a fazer.')
    return
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { name: TEST_USER_NAME },
  })

  if (error) {
    console.error('Erro ao criar utilizador de teste:', error.message)
    process.exit(1)
  }

  console.log(`✓ Utilizador de teste criado (id: ${data.user.id}).`)
  console.log('  O trigger handle_new_user cria o perfil automaticamente.')
}

createTestUser()
