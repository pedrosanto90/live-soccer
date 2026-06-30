-- Escalões (tiers): nova dimensão organizacional das equipas e dos torneios.

-- Enum de escalões (fixos na app)
create type team_tier as enum (
  'seniors',
  'veterans',
  'female',
  'benjamins'
);

-- Adicionar escalão à tabela teams
alter table teams
  add column if not exists tier team_tier not null default 'seniors';

-- Configuração de escalões ao torneio.
-- multi_tier: se true, o torneio tem múltiplos escalões.
-- tier_schedule: jsonb com os dias de jogo por escalão.
-- ex: { "seniors": ["2025-06-14", "2025-06-15"], "veterans": ["2025-06-16"] }
alter table tournaments
  add column if not exists multi_tier boolean not null default false,
  add column if not exists tier_schedule jsonb not null default '{}'::jsonb;

-- Índice para filtrar equipas (e, via JOIN, jogos) por escalão.
create index if not exists teams_tier_idx on teams (tournament_id, tier);

-- O unique constraint de equipas passa a incluir o escalão, permitindo equipas
-- com o mesmo nome em escalões diferentes.
alter table teams drop constraint if exists teams_tournament_id_name_key;
alter table teams add constraint teams_tournament_id_name_tier_key
  unique (tournament_id, name, tier);
