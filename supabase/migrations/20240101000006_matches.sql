-- Jogos
create table matches (
  id                  uuid primary key default gen_random_uuid(),
  tournament_id       uuid not null references tournaments(id) on delete cascade,
  phase_id            uuid not null references tournament_phases(id),
  group_id            uuid references groups(id),
  home_team_id        uuid not null references teams(id),
  away_team_id        uuid not null references teams(id),
  referee_id          uuid references referees(id),
  venue               text,
  scheduled_at        timestamptz,
  status              match_status not null default 'scheduled',
  current_period      match_period,

  -- Resultado
  home_score          int not null default 0,
  away_score          int not null default 0,
  home_score_extra    int not null default 0,
  away_score_extra    int not null default 0,
  home_penalties      int not null default 0,
  away_penalties      int not null default 0,

  -- Faltas por parte
  home_fouls_h1       int not null default 0,
  away_fouls_h1       int not null default 0,
  home_fouls_h2       int not null default 0,
  away_fouls_h2       int not null default 0,
  home_fouls_extra    int not null default 0,
  away_fouls_extra    int not null default 0,

  -- Override de configurações do torneio para este jogo
  settings_override   jsonb,

  -- Timer
  timer_started_at    timestamptz,
  timer_elapsed_secs  int not null default 0,

  started_at          timestamptz,
  finished_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint different_teams check (home_team_id != away_team_id)
);

-- Eventos de jogo (golos, faltas, cartões)
create table match_events (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null references matches(id) on delete cascade,
  team_id         uuid not null references teams(id),
  player_id       uuid references players(id),
  player_name     text,
  event_type      event_type not null,
  period          match_period not null,
  elapsed_secs    int not null,
  is_cancelled    boolean not null default false,
  cancelled_at    timestamptz,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now()
);

-- Série de penáltis
create table penalty_kicks (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null references matches(id) on delete cascade,
  team_id         uuid not null references teams(id),
  player_id       uuid references players(id),
  player_name     text,
  kick_order      int not null,
  scored          boolean not null,
  created_at      timestamptz not null default now()
);
