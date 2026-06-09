-- Classificação por grupo
create table standings (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references groups(id) on delete cascade,
  team_id         uuid not null references teams(id) on delete cascade,
  played          int not null default 0,
  won             int not null default 0,
  drawn           int not null default 0,
  lost            int not null default 0,
  goals_for       int not null default 0,
  goals_against   int not null default 0,
  goal_difference int generated always as (goals_for - goals_against) stored,
  points          int not null default 0,
  yellow_cards    int not null default 0,
  red_cards       int not null default 0,
  updated_at      timestamptz not null default now(),
  unique (group_id, team_id)
);

-- Suspensões por acumulação de cartões
create table suspensions (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references players(id) on delete cascade,
  tournament_id   uuid not null references tournaments(id) on delete cascade,
  matches_count   int not null default 1,
  reason          text,
  applied         boolean not null default false,
  created_at      timestamptz not null default now()
);
