-- S3-02 / 3789-3792. Aplicar sobre la BD existente, como administrador.
-- Conserva la RPC de cuatro argumentos para clientes anteriores.
-- Los dos primeros argumentos son obligatorios (aceptan null) para que PostgREST
-- distinga esta variante de la anterior sin ambigüedad.
begin;

create or replace function public.recommend_posts(
  p_nature text,
  p_sector_id text,
  p_limit integer default 9,
  p_exclude uuid[] default '{}'::uuid[],
  p_roles text[] default null::text[],
  p_min_score numeric default -1
)
returns table (
  id uuid, author_id uuid, title text, description text,
  created_at timestamptz, image_url text, affinity numeric,
  profiles jsonb, post_tags jsonb, recommendation jsonb
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  wanted_nature text := nullif(btrim(p_nature), '');
  wanted_sector text := nullif(btrim(p_sector_id), '');
begin
  if wanted_nature is not null and wanted_nature not in ('bien', 'servicio', 'ambos') then
    raise exception 'Naturaleza no válida' using errcode = '22023';
  end if;

  return query
  select p.id, p.author_id, p.title, p.description, p.created_at, p.image_url,
    scores.affinity,
    jsonb_build_object('full_name', pr.full_name, 'role', pr.role),
    scores.tags,
    jsonb_build_object(
      'nature', pc.nature,
      'sector_id', pc.sector_id,
      'sector_name', s.name,
      'requested_nature', wanted_nature,
      'matched_nature', wanted_nature is not null,
      'matched_sector', wanted_sector is not null
    )
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  left join public.provider_classifications pc on pc.profile_id = p.author_id
  left join public.sectors s on s.id = pc.sector_id
  cross join lateral (
    select
      coalesce(sum(uts.score::numeric * abs(uts.score::numeric)) /
        nullif(sum(abs(uts.score::numeric)), 0), 0) as affinity,
      coalesce(jsonb_agg(jsonb_build_object('tags', jsonb_build_object(
        'id', t.id, 'name', t.name,
        'user_tag_scores', case when uts.score is null then '[]'::jsonb
          else jsonb_build_array(jsonb_build_object('score', uts.score)) end
      )) order by t.name, t.id), '[]'::jsonb) as tags
    from public.post_tags pt
    join public.tags t on t.id = pt.tag_id
    left join public.user_tag_scores uts on uts.tag_id = pt.tag_id and uts.user_id = auth.uid()
    where pt.post_id = p.id
  ) scores
  where auth.uid() is not null
    and p.author_id <> auth.uid()
    and scores.affinity >= coalesce(p_min_score, -1)
    and not exists (select 1 from unnest(p_exclude) excluded(id) where excluded.id = p.id)
    and (p_roles is null or pr.role = any(p_roles))
    and (wanted_nature is null or pc.nature = wanted_nature or pc.nature = 'ambos')
    and (wanted_sector is null or (pc.sector_id = wanted_sector and s.active))
    and not exists (
      select 1 from public.reactions r
      where r.post_id = p.id and r.user_id = auth.uid() and r.interested = false
    )
  order by random()
  limit least(greatest(coalesce(p_limit, 9), 0), 50);
end;
$$;

revoke all on function public.recommend_posts(text, text, integer, uuid[], text[], numeric) from public, anon;
grant execute on function public.recommend_posts(text, text, integer, uuid[], text[], numeric) to authenticated, service_role;
notify pgrst, 'reload schema';
commit;
