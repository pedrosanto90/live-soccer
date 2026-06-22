# Live Soccer

Aplicação de **gestão e acompanhamento ao vivo de torneios de futebol**. Permite organizar torneios completos — equipas, jogadores, fases, sorteios e calendário — e transmitir os jogos ao vivo, com placar e classificações que atualizam em tempo real para o público, sem necessidade de refresh.

Stack: **Next.js 16** (App Router, React 19) · **Supabase** (Postgres, Auth, Realtime) · **shadcn/ui** + **Tailwind v4**. Interface em Português.

> Consulta [`FEATURES.md`](./FEATURES.md) para a lista completa de funcionalidades.

## Como funciona

A app tem duas faces:

- **Área de administração** (autenticada) — onde o organizador cria e gere o torneio.
- **Vista pública** (sem login) — onde adeptos seguem resultados, placares e classificações ao vivo.

### Fluxo típico de utilização

1. **Criar conta / entrar** em `/register` ou `/login`.
2. **Criar um torneio** no dashboard (fica em *rascunho*, oculto do público).
3. **Adicionar equipas e jogadores** a cada equipa.
4. **Definir fases** (grupos e/ou eliminatórias) e criar os grupos.
5. **Fazer o sorteio** das equipas pelos grupos (aleatório ou com seed reproduzível) — os jogos de grupo são gerados automaticamente.
6. **Agendar os jogos** por dia, com distribuição automática de horários.
7. **Ativar o torneio** para o tornar público.
8. **Gerir o jogo ao vivo**: controlar o cronómetro (partes e prolongamento), registar golos, cartões e faltas, e resolver desempates por grandes penalidades.
9. As **eliminatórias** geram o bracket automaticamente e fazem avançar o vencedor de cada confronto.
10. **Classificações e placares** atualizam ao vivo na vista pública via Supabase Realtime.
11. **Finalizar o torneio** quando terminar.

### Páginas públicas

- `/t/[slug]` — página pública do torneio (com pesquisa).
- `/match/[matchId]/placar` — placar de um jogo, para projeção/transmissão.
- `/match/[matchId]/public` — painel público detalhado do jogo.

## Correr localmente

### Pré-requisitos

- **Node.js 20+** e npm.
- Um projeto **Supabase** (a base de dados é alojada na cloud).

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Copia o template e preenche com as credenciais do teu projeto Supabase:

```bash
cp .env.example .env.local
```

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave publishable (`sb_publishable_...`) — browser/server |
| `SUPABASE_SECRET_KEY` | Chave secreta (`sb_secret_...`) — **apenas servidor**, nunca expor ao browser |
| `NEXT_PUBLIC_APP_URL` | URL base da app (`http://localhost:3000` em local) |
| `CYPRESS_TEST_USER_EMAIL` / `CYPRESS_TEST_USER_PASSWORD` | Credenciais do utilizador usado nos testes E2E |

### 3. Base de dados

O schema vive em migrações SQL ordenadas em `supabase/migrations/`. Aplica-as ao teu projeto Supabase (CLI ou painel) antes do primeiro arranque:

```bash
supabase db push        # aplica as migrações ao projeto remoto
```

### 4. Arrancar o servidor de desenvolvimento

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Testes locais

Testes unitários/integração com **Vitest** e E2E com **Cypress**.

```bash
# Unitários
npm run test            # corre uma vez
npm run test:watch      # modo watch
npm run test:coverage   # com cobertura
npm run test:ui         # interface gráfica do Vitest

# E2E (Cypress)
npm run test:create-user   # cria o utilizador de teste no Supabase (usa .env.local)
npm run cy:open            # abre o Cypress interativo
npm run cy:run             # corre headless
```

> Para os testes E2E, garante que o servidor (`npm run dev`) está a correr e que o utilizador de teste existe (`npm run test:create-user`).

## Scripts disponíveis

```bash
npm run dev       # servidor de desenvolvimento (http://localhost:3000)
npm run build     # build de produção
npm run start     # servir a build de produção
npm run lint      # eslint
npm run test      # testes unitários (Vitest)
npm run cy:run    # testes E2E (Cypress)
```

## Estrutura do projeto

```
app/
  (auth)/      → /login, /register
  (app)/       → área autenticada (dashboard, torneios, equipas, jogos…)
  (public)/    → páginas públicas (torneio, placar, painel de jogo)
components/     → UI por domínio (tournament, team, match, phase, bracket, standings…)
lib/
  actions/     → Server Actions (mutações, validadas com Zod)
  queries/     → leituras de dados
  validations/ → schemas Zod
  supabase/    → factories de cliente (browser / server / proxy)
supabase/
  migrations/  → schema SQL ordenado (tabelas, RLS, triggers, realtime)
```
