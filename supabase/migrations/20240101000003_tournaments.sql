-- Torneios
create table tournaments (
  id              uuid primary key default gen_random_uuid(),
  created_by      uuid not null references profiles(id),
  name            text not null,
  slug            text not null unique,
  description     text,
  logo_url        text,
  status          tournament_status not null default 'draft',
  visibility      tournament_visibility not null default 'public',
  starts_at       date,
  ends_at         date,
  settings        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Membros do torneio (roles por torneio)
create table tournament_members (
  tournament_id   uuid not null references tournaments(id) on delete cascade,
  profile_id      uuid not null references profiles(id) on delete cascade,
  role            user_role not null default 'viewer',
  created_at      timestamptz not null default now(),
  primary key (tournament_id, profile_id)
);

-- Árbitros por torneio
create table tournament_referees (
  tournament_id   uuid not null references tournaments(id) on delete cascade,
  referee_id      uuid not null references referees(id) on delete cascade,
  primary key (tournament_id, referee_id)
);
