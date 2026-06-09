-- Extensões
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Enums
create type tournament_status as enum (
  'draft',
  'active',
  'finished',
  'cancelled'
);

create type tournament_visibility as enum (
  'public',
  'private'
);

create type phase_type as enum (
  'group',
  'knockout'
);

create type match_status as enum (
  'scheduled',
  'in_progress',
  'half_time',
  'extra_time',
  'penalties',
  'finished',
  'cancelled'
);

create type match_period as enum (
  'first_half',
  'second_half',
  'extra_first',
  'extra_second',
  'penalties'
);

create type event_type as enum (
  'goal',
  'own_goal',
  'foul',
  'yellow_card',
  'red_card',
  'penalty_scored',
  'penalty_missed'
);

create type player_position as enum (
  'goalkeeper',
  'defender',
  'midfielder',
  'forward'
);

create type tiebreak_criterion as enum (
  'points',
  'head_to_head',
  'goal_difference',
  'goals_scored',
  'goals_conceded',
  'yellow_cards',
  'red_cards',
  'draw'
);

create type user_role as enum (
  'admin',
  'operator',
  'viewer'
);
