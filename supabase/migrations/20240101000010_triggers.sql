-- Função genérica de updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

create trigger trg_tournaments_updated_at
  before update on tournaments
  for each row execute function update_updated_at();

create trigger trg_teams_updated_at
  before update on teams
  for each row execute function update_updated_at();

create trigger trg_players_updated_at
  before update on players
  for each row execute function update_updated_at();

create trigger trg_matches_updated_at
  before update on matches
  for each row execute function update_updated_at();

-- Auto-criação de perfil quando um utilizador se regista no Supabase Auth
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Auto-adição do criador do torneio como admin
create or replace function handle_new_tournament()
returns trigger language plpgsql security definer as $$
begin
  insert into tournament_members (tournament_id, profile_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end;
$$;

create trigger trg_on_tournament_created
  after insert on tournaments
  for each row execute function handle_new_tournament();

-- Inicialização de standings quando uma equipa entra num grupo
create or replace function handle_group_team_added()
returns trigger language plpgsql as $$
begin
  insert into standings (group_id, team_id)
  values (new.group_id, new.team_id)
  on conflict (group_id, team_id) do nothing;
  return new;
end;
$$;

create trigger trg_on_group_team_added
  after insert on group_teams
  for each row execute function handle_group_team_added();
