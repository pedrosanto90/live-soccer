-- Fases do torneio
create table tournament_phases (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references tournaments(id) on delete cascade,
  name            text not null,
  type            phase_type not null,
  order_index     int not null default 0,
  created_at      timestamptz not null default now()
);

-- Grupos (dentro de uma fase de grupos)
create table groups (
  id              uuid primary key default gen_random_uuid(),
  phase_id        uuid not null references tournament_phases(id) on delete cascade,
  name            text not null,
  order_index     int not null default 0,
  created_at      timestamptz not null default now()
);

-- Equipas por grupo
create table group_teams (
  group_id        uuid not null references groups(id) on delete cascade,
  team_id         uuid not null references teams(id) on delete cascade,
  primary key (group_id, team_id)
);
