-- Corrige funções SECURITY DEFINER que falhavam no signup com
-- "relation \"profiles\" does not exist" (SQLSTATE 42P01).
--
-- Causa: triggers SECURITY DEFINER em auth.users correm no contexto do GoTrue,
-- cujo search_path não inclui `public`. As referências não qualificadas
-- (`profiles`, `tournament_members`) não resolviam.
--
-- Correção (recomendação Supabase): fixar `search_path = ''` e qualificar
-- totalmente os nomes das tabelas. Também resolve o advisor de segurança de
-- "function search path mutable".

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create or replace function public.handle_new_tournament()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tournament_members (tournament_id, profile_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end;
$$;
