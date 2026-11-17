-- Aplicar únicamente esta migración sobre el proyecto existente.
begin;
alter table public.posts add column if not exists nature text;
alter table public.posts add column if not exists sector_id text references public.sectors(id);
alter table public.posts drop constraint if exists posts_offer_classification;
alter table public.posts add constraint posts_offer_classification check (
  (nature is null and sector_id is null) or
  (nature is not null and nature in ('bien', 'servicio') and sector_id is not null)
);
create index if not exists posts_classification_idx on public.posts(nature, sector_id, created_at desc);

-- Las publicaciones anteriores se conservan sin clasificar; no inferir su oferta del perfil.
create or replace function public.validate_offer() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare author_role text;
begin
  select role into author_role from public.profiles where id = new.author_id;
  if TG_OP = 'INSERT' and author_role in ('proveedor', 'socio') and new.nature is null then
    raise exception 'Selecciona naturaleza y rubro de la oferta' using errcode = '22023';
  end if;
  if new.nature is not null then
    if author_role not in ('proveedor', 'socio') or author_role is null then
      raise exception 'Solo proveedores y socios publican ofertas' using errcode = '42501';
    end if;
    if not exists (select 1 from public.sectors where id = new.sector_id and active) then
      raise exception 'Rubro no disponible' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists validate_offer on public.posts;
create trigger validate_offer before insert or update of nature, sector_id, author_id on public.posts
for each row execute function public.validate_offer();

-- Restringir la política previa, que permitía etiquetar publicaciones ajenas.
drop policy if exists post_tags_owner_insert on public.post_tags;
create policy post_tags_owner_insert on public.post_tags as restrictive for insert to authenticated
with check (exists (select 1 from public.posts where id = post_id and author_id = auth.uid()));

-- Post y etiquetas se guardan en la misma transacción; cualquier error revierte todo.
create or replace function public.create_classified_post(
  p_title text, p_description text, p_nature text, p_sector_id text,
  p_tags text[] default '{}', p_image_url text default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare post_id uuid; tag_id uuid; tag_name text;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Inicia sesión para publicar' using errcode = '42501';
  end if;
  if p_title is null or length(btrim(p_title)) not between 3 and 160
    or p_description is null or length(btrim(p_description)) not between 10 and 5000
    or coalesce(cardinality(p_tags), 0) > 10 then
    raise exception 'Revisa título, descripción y etiquetas' using errcode = '22023';
  end if;
  insert into public.posts(author_id, title, description, nature, sector_id, image_url)
  values (auth.uid(), btrim(p_title), btrim(p_description), nullif(p_nature,''), nullif(p_sector_id,''), p_image_url)
  returning id into post_id;
  for tag_name in select distinct btrim(value) from unnest(p_tags) value loop
    if tag_name is null or length(tag_name) not between 1 and 50 then
      raise exception 'Etiqueta no válida' using errcode = '22023';
    end if;
    insert into public.tags(name) values (tag_name) on conflict (name) do nothing;
    select id into strict tag_id from public.tags where name = tag_name;
    insert into public.post_tags(post_id, tag_id) values (post_id, tag_id);
  end loop;
  return post_id;
end;
$$;
revoke all on function public.create_classified_post(text,text,text,text,text[],text) from public, anon;
grant execute on function public.create_classified_post(text,text,text,text,text[],text) to authenticated;

-- Solo ofertas explícitamente clasificadas. Todas las palabras deben aparecer en
-- título, descripción o etiquetas; AND con naturaleza/rubro. Respeta las RLS.
create or replace function public.candidate_offers(
  p_query text default '', p_nature text default null, p_sector_id text default null, p_limit integer default 12
) returns table (
  id uuid, author_id uuid, title text, description text, image_url text,
  created_at timestamptz, nature text, sector_id text, sectors jsonb,
  profiles jsonb, post_tags jsonb
) language plpgsql security invoker set search_path = '' as $$
begin
  if length(coalesce(p_query,'')) > 300 or (p_nature is not null and p_nature not in ('bien','servicio')) then
    raise exception 'Filtros no válidos' using errcode = '22023';
  end if;
  return query
  select p.id, p.author_id, p.title, p.description, p.image_url, p.created_at, p.nature, p.sector_id,
    jsonb_build_object('name', s.name), jsonb_build_object('full_name', pr.full_name, 'role', pr.role),
    coalesce(tags.items, '[]'::jsonb)
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  join public.sectors s on s.id = p.sector_id and s.active
  left join lateral (
    select jsonb_agg(jsonb_build_object('tags',jsonb_build_object('id',t.id,'name',t.name)) order by t.name) items,
      string_agg(t.name, ' ') names
    from public.post_tags pt join public.tags t on t.id = pt.tag_id where pt.post_id = p.id
  ) tags on true
  where auth.uid() is not null and p.nature is not null and pr.role in ('proveedor','socio')
    and (p_nature is null or p.nature = p_nature)
    and (p_sector_id is null or p.sector_id = p_sector_id)
    and not exists (
      select 1 from regexp_split_to_table(lower(btrim(coalesce(p_query,''))), '\s+') word
      where word <> '' and position(word in lower(p.title || ' ' || coalesce(p.description,'') || ' ' || coalesce(tags.names,''))) = 0
    )
  order by p.created_at desc, p.id
  limit least(greatest(coalesce(p_limit,12),0),30);
end;
$$;
revoke all on function public.candidate_offers(text,text,text,integer) from public, anon;
grant execute on function public.candidate_offers(text,text,text,integer) to authenticated;

-- Cuota compartida entre instancias: 10 consultas externas por usuario / 10 minutos.
create table if not exists public.assistant_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null, requests integer not null,
  primary key (user_id, window_start)
);
alter table public.assistant_usage enable row level security;
revoke all on public.assistant_usage from public, anon, authenticated;
create or replace function public.consume_assistant_quota() returns boolean
language plpgsql security definer set search_path = '' as $$
declare used integer; bucket timestamptz := date_bin('10 minutes', now(), timestamptz '2020-01-01');
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Inicia sesión' using errcode = '42501';
  end if;
  delete from public.assistant_usage where user_id = auth.uid() and window_start < bucket;
  insert into public.assistant_usage(user_id, window_start, requests) values(auth.uid(), bucket, 1)
  on conflict (user_id, window_start) do update set requests = public.assistant_usage.requests + 1
    where public.assistant_usage.requests < 10
  returning requests into used;
  return used is not null;
end;
$$;
revoke all on function public.consume_assistant_quota() from public, anon;
grant execute on function public.consume_assistant_quota() to authenticated;
notify pgrst, 'reload schema';
commit;
