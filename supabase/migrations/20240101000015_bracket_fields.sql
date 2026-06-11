-- Campos de bracket para fases de eliminatórias.
--
-- Os jogos de eliminatórias são criados todos de uma vez quando o bracket é
-- gerado, mas as equipas das rondas seguintes (meias, final) só ficam decididas
-- à medida que os jogos anteriores terminam. Por isso as equipas passam a ser
-- nullable: um slot por preencher representa "A definir". A constraint
-- `different_teams` continua válida — `null != null` avalia para NULL, que o
-- Postgres aceita numa CHECK.
alter table matches
  alter column home_team_id drop not null,
  alter column away_team_id drop not null;

-- bracket_round    — número de jogos da ronda (1=final, 2=meias, 4=quartos, ...)
-- bracket_position — posição (0-indexed) dentro da ronda
-- next_match_id    — jogo para onde o vencedor avança (null na final)
-- next_match_slot  — 'home' ou 'away' no jogo seguinte
alter table matches
  add column if not exists bracket_round    int,
  add column if not exists bracket_position int,
  add column if not exists next_match_id     uuid references matches(id) on delete set null,
  add column if not exists next_match_slot   text check (next_match_slot in ('home', 'away'));

create index if not exists matches_bracket_idx
  on matches (phase_id, bracket_round, bracket_position);
