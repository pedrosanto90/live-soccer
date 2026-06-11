-- O Realtime avalia as políticas RLS de UPDATE/DELETE contra o registo ANTIGO.
-- Com replica identity por omissão, esse registo só inclui a primary key, pelo
-- que políticas que dependem de outras colunas (matches→tournament_id,
-- match_events→match_id, standings→group_id, penalty_kicks→match_id) falham a
-- autorização e os eventos são descartados em silêncio.
--
-- REPLICA IDENTITY FULL inclui todas as colunas no registo antigo, permitindo
-- ao Realtime autorizar (e filtrar) correctamente os UPDATE/DELETE — sem isto,
-- pausar/retomar o cronómetro e os golos nunca chegam aos painéis ao vivo.
alter table matches replica identity full;
alter table match_events replica identity full;
alter table standings replica identity full;
alter table penalty_kicks replica identity full;
