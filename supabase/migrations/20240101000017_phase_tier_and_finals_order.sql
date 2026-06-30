-- Geração de bracket tier-aware e ordem das finais em torneios multi-escalão.

-- Escalão de uma fase knockout. Nullable: null = fase mono-escalão (todas as
-- equipas) — mantém o comportamento dos torneios sem escalões.
alter table tournament_phases
  add column if not exists tier team_tier;

-- Ordem das finais por escalão (array de team_tier). A geração do bracket agenda
-- as finais de todos os escalões no fim do torneio, por esta ordem.
-- ex: ["benjamins", "seniors"]
alter table tournaments
  add column if not exists finals_order jsonb not null default '[]'::jsonb;
