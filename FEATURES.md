# Funcionalidades — Live Soccer

Aplicação de gestão e acompanhamento ao vivo de torneios de futebol.
Stack: Next.js 16 (App Router, React 19) + Supabase (Postgres, Auth, Realtime) + shadcn/ui + Tailwind v4.

## 🔐 Autenticação & Contas
- Registo e login de utilizadores (Supabase Auth) com criação automática de perfil
- Área administrativa protegida por defesa-em-profundidade (proxy + layout + verificação por página)
- Páginas públicas separadas, sem necessidade de login

## 🏆 Gestão de Torneios
- Criação, edição e configuração de torneios
- Estados de ciclo de vida: rascunho → ativar → finalizar
- Torneios em rascunho ficam ocultos das vistas públicas
- Partilha de torneio por link/slug público
- Dashboard com listagem de torneios

## 👥 Equipas & Jogadores
- Gestão de equipas (criar, editar, listar, ficha de equipa)
- Gestão de plantel/jogadores com posições
- Emblema/avatar por equipa

## 📋 Fases, Grupos & Sorteio
- Criação e ordenação de fases (grupos e eliminatórias)
- Geração automática de grupos
- Sorteio de equipas pelos grupos — aleatório ou com seed (reproduzível), com validação de requisitos
- Geração automática de jogos dentro de cada grupo

## 🗓️ Calendário de Jogos
- Agendamento de jogos por dia (modal de schedule)
- Distribuição automática de slots de jogos com base na duração
- Criação manual e edição de jogos
- Filtros na lista de jogos (admin)

## ⚽ Painel de Jogo ao Vivo (Admin)
- Cronómetro de jogo controlável: iniciar, pausar, retomar, reset, ajuste manual e sincronização
- Gestão de períodos: 1ª/2ª parte e prolongamento (duas partes de extra time)
- Registo de eventos em tempo real: golos, cartões, faltas
- Edição e cancelamento de eventos
- Desempate por grandes penalidades (penalty shootout)
- Finalização de jogo

## 🥇 Eliminatórias (Bracket)
- Geração automática do quadro de eliminatórias
- Avanço automático do vencedor para a fase seguinte
- Reset do bracket
- Visualização gráfica do bracket

## 📊 Classificações
- Tabela de classificação por grupo com cálculo e ordenação automática (critérios de desempate)
- Atualização das standings conforme os resultados

## 📡 Vista Pública & Tempo Real
- Página pública do torneio (`/t/[slug]`) com pesquisa
- Placar público de jogo (`/match/[matchId]/placar`) e painel público detalhado
- Realtime via Supabase em jogos, eventos, penáltis e classificações — atualização ao vivo sem refresh

## 🎨 Base Técnica
- Next.js 16 (App Router, React 19), Supabase (Postgres + Auth + Realtime)
- RLS ativo em todas as tabelas
- shadcn/ui + Tailwind v4, tema claro/escuro
- UI 100% em Português
