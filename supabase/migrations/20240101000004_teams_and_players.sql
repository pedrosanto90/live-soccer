-- Equipas
create table teams (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references tournaments(id) on delete cascade,
  name            text not null,
  short_name      text,
  color_primary   text not null default '#000000',
  color_secondary text not null default '#ffffff',
  logo_url        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tournament_id, name)
);

-- Jogadores
create table players (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references teams(id) on delete cascade,
  name            text not null,
  number          int,
  position        player_position,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
