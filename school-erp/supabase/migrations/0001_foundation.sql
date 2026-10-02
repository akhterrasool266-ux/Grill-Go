-- 0001 · Foundation: schemas, extensions, shared helpers.
-- `private` is deliberately NOT in PostgREST's exposed schemas, so none of the
-- security helpers in it can be called over the REST API (RLS still uses them).
set search_path = public, extensions;

create extension if not exists pg_trgm with schema extensions;
create extension if not exists btree_gist with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Returns (old subset, new subset) containing only keys whose value changed.
create or replace function private.jsonb_diff(p_old jsonb, p_new jsonb, out o jsonb, out n jsonb)
language sql immutable as $$
  select
    coalesce(jsonb_object_agg(k, p_old -> k) filter (where (p_old -> k) is distinct from (p_new -> k)), '{}'::jsonb),
    coalesce(jsonb_object_agg(k, p_new -> k) filter (where (p_old -> k) is distinct from (p_new -> k)), '{}'::jsonb)
  from (select jsonb_object_keys(coalesce(p_old,'{}') || coalesce(p_new,'{}')) k) keys
  where k not in ('updated_at')
$$;
