-- O painel ao vivo precisa de receber cada penálti em tempo real (o histórico
-- alternado e o placar da série). As restantes tabelas já estão na publicação.
alter publication supabase_realtime add table penalty_kicks;
