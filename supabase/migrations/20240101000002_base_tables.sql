-- Perfis de utilizador
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Árbitros (independentes de torneio)
create table referees (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  phone       text,
  created_at  timestamptz not null default now()
);
