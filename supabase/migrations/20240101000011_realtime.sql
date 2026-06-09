-- Activar Realtime nas tabelas necessárias para o painel público ao vivo
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table match_events;
alter publication supabase_realtime add table standings;
