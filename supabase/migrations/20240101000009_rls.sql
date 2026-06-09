-- Activar RLS em todas as tabelas
alter table profiles             enable row level security;
alter table tournaments          enable row level security;
alter table tournament_members   enable row level security;
alter table teams                enable row level security;
alter table players              enable row level security;
alter table tournament_phases    enable row level security;
alter table groups               enable row level security;
alter table group_teams          enable row level security;
alter table referees             enable row level security;
alter table tournament_referees  enable row level security;
alter table matches              enable row level security;
alter table match_events         enable row level security;
alter table penalty_kicks        enable row level security;
alter table standings            enable row level security;
alter table suspensions          enable row level security;

-- Funções helper
create or replace function is_tournament_member(t_id uuid, min_role user_role default 'viewer')
returns boolean language sql security definer as $$
  select exists (
    select 1 from tournament_members
    where tournament_id = t_id
      and profile_id = auth.uid()
      and case min_role
            when 'admin'    then role = 'admin'
            when 'operator' then role in ('admin', 'operator')
            else true
          end
  );
$$;

create or replace function is_tournament_creator(t_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from tournaments
    where id = t_id and created_by = auth.uid()
  );
$$;

-- PROFILES
create policy "Utilizador vê o próprio perfil"
  on profiles for select using (id = auth.uid());

create policy "Utilizador edita o próprio perfil"
  on profiles for update using (id = auth.uid());

create policy "Registo automático de perfil"
  on profiles for insert with check (id = auth.uid());

-- TOURNAMENTS
create policy "Torneios públicos visíveis a todos"
  on tournaments for select
  using (visibility = 'public' or is_tournament_member(id));

create policy "Autenticados criam torneios"
  on tournaments for insert
  with check (auth.uid() is not null and created_by = auth.uid());

create policy "Admin edita torneio"
  on tournaments for update
  using (is_tournament_creator(id));

create policy "Admin apaga torneio"
  on tournaments for delete
  using (is_tournament_creator(id));

-- TOURNAMENT_MEMBERS
create policy "Membros vêem membros do mesmo torneio"
  on tournament_members for select
  using (is_tournament_member(tournament_id));

create policy "Admin gere membros"
  on tournament_members for all
  using (is_tournament_creator(tournament_id));

-- TEAMS
create policy "Equipas públicas"
  on teams for select
  using (exists (
    select 1 from tournaments t
    where t.id = tournament_id
      and (t.visibility = 'public' or is_tournament_member(t.id))
  ));

create policy "Admin/operator gerem equipas"
  on teams for all
  using (is_tournament_member(tournament_id, 'operator'));

-- PLAYERS
create policy "Jogadores públicos"
  on players for select
  using (exists (
    select 1 from teams te
    join tournaments t on t.id = te.tournament_id
    where te.id = team_id
      and (t.visibility = 'public' or is_tournament_member(t.id))
  ));

create policy "Admin/operator gerem jogadores"
  on players for all
  using (exists (
    select 1 from teams te
    where te.id = team_id
      and is_tournament_member(te.tournament_id, 'operator')
  ));

-- TOURNAMENT_PHASES
create policy "Fases públicas"
  on tournament_phases for select
  using (exists (
    select 1 from tournaments t where t.id = tournament_id
      and (t.visibility = 'public' or is_tournament_member(t.id))
  ));

create policy "Admin gere fases"
  on tournament_phases for all
  using (is_tournament_member(tournament_id, 'admin'));

-- GROUPS
create policy "Grupos públicos"
  on groups for select
  using (exists (
    select 1 from tournament_phases p
    join tournaments t on t.id = p.tournament_id
    where p.id = phase_id
      and (t.visibility = 'public' or is_tournament_member(t.id))
  ));

create policy "Admin gere grupos"
  on groups for all
  using (exists (
    select 1 from tournament_phases p
    where p.id = phase_id and is_tournament_member(p.tournament_id, 'admin')
  ));

-- GROUP_TEAMS
create policy "Group teams públicos"
  on group_teams for select
  using (exists (
    select 1 from groups g
    join tournament_phases p on p.id = g.phase_id
    join tournaments t on t.id = p.tournament_id
    where g.id = group_id
      and (t.visibility = 'public' or is_tournament_member(t.id))
  ));

create policy "Admin gere group teams"
  on group_teams for all
  using (exists (
    select 1 from groups g
    join tournament_phases p on p.id = g.phase_id
    where g.id = group_id and is_tournament_member(p.tournament_id, 'admin')
  ));

-- REFEREES
create policy "Árbitros visíveis a autenticados"
  on referees for select
  using (auth.uid() is not null);

create policy "Admin gere árbitros"
  on referees for all
  using (auth.uid() is not null);

-- TOURNAMENT_REFEREES
create policy "Tournament referees públicos"
  on tournament_referees for select
  using (exists (
    select 1 from tournaments t where t.id = tournament_id
      and (t.visibility = 'public' or is_tournament_member(t.id))
  ));

create policy "Admin gere tournament referees"
  on tournament_referees for all
  using (is_tournament_member(tournament_id, 'admin'));

-- MATCHES
create policy "Jogos públicos"
  on matches for select
  using (exists (
    select 1 from tournaments t
    where t.id = tournament_id
      and (t.visibility = 'public' or is_tournament_member(t.id))
  ));

create policy "Admin/operator gerem jogos"
  on matches for all
  using (is_tournament_member(tournament_id, 'operator'));

-- MATCH_EVENTS
create policy "Eventos públicos"
  on match_events for select
  using (exists (
    select 1 from matches m
    join tournaments t on t.id = m.tournament_id
    where m.id = match_id
      and (t.visibility = 'public' or is_tournament_member(t.id))
  ));

create policy "Operator regista eventos"
  on match_events for insert
  with check (exists (
    select 1 from matches m
    where m.id = match_id
      and is_tournament_member(m.tournament_id, 'operator')
  ));

create policy "Operator cancela eventos"
  on match_events for update
  using (exists (
    select 1 from matches m
    where m.id = match_id
      and is_tournament_member(m.tournament_id, 'operator')
  ));

-- PENALTY_KICKS
create policy "Penáltis públicos"
  on penalty_kicks for select
  using (exists (
    select 1 from matches m
    join tournaments t on t.id = m.tournament_id
    where m.id = match_id
      and (t.visibility = 'public' or is_tournament_member(t.id))
  ));

create policy "Operator regista penáltis"
  on penalty_kicks for all
  using (exists (
    select 1 from matches m
    where m.id = match_id and is_tournament_member(m.tournament_id, 'operator')
  ));

-- STANDINGS
create policy "Classificação pública"
  on standings for select
  using (exists (
    select 1 from groups g
    join tournament_phases p on p.id = g.phase_id
    join tournaments t on t.id = p.tournament_id
    where g.id = group_id
      and (t.visibility = 'public' or is_tournament_member(t.id))
  ));

create policy "Sistema actualiza standings"
  on standings for all
  using (auth.uid() is not null);

-- SUSPENSIONS
create policy "Suspensões visíveis a membros"
  on suspensions for select
  using (is_tournament_member(tournament_id));

create policy "Admin gere suspensões"
  on suspensions for all
  using (is_tournament_member(tournament_id, 'admin'));
