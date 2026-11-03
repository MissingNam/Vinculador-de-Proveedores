-- HU-C3 / HU-C4. Execute once in the Supabase SQL Editor as project administrator.
-- Adds independent tables; does not alter existing posts, profiles or their policies.
begin;

create table public.sectors (
  id text primary key,
  name text not null unique check (char_length(btrim(name)) between 2 and 100),
  active boolean not null default true,
  sort_order integer not null default 0
);

insert into public.sectors (id, name, sort_order) values
  ('alimentos', 'Alimentos y bebidas', 10),
  ('construccion', 'Construcción y materiales', 20),
  ('empaque', 'Empaque y embalaje', 30),
  ('industria', 'Maquinaria e insumos industriales', 40),
  ('mantenimiento', 'Mantenimiento y reparación', 50),
  ('tecnologia', 'Tecnología y software', 60),
  ('transporte', 'Transporte y logística', 70),
  ('profesionales', 'Servicios profesionales', 80),
  ('salud', 'Salud e higiene', 90),
  ('otros', 'Otros rubros', 100);

create table public.provider_classifications (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  nature text not null check (nature in ('bien', 'servicio', 'ambos')),
  sector_id text not null references public.sectors(id),
  updated_at timestamptz not null default now()
);

create table public.needs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 5 and 120),
  description text not null check (char_length(btrim(description)) between 10 and 4000),
  nature text not null check (nature in ('bien', 'servicio')),
  sector_id text not null references public.sectors(id),
  country text not null check (char_length(btrim(country)) between 2 and 80),
  region text not null check (char_length(btrim(region)) between 2 and 100),
  city text not null check (char_length(btrim(city)) between 2 and 100),
  budget_min numeric(14,2) not null check (budget_min >= 0),
  budget_max numeric(14,2) not null check (budget_max > 0 and budget_max >= budget_min),
  currency text not null check (currency in ('MXN', 'USD')),
  quantity numeric(14,3),
  unit text,
  delivery_date date,
  service_mode text,
  service_scope text,
  start_date date,
  end_date date,
  status text not null default 'abierta' check (status in ('abierta', 'cerrada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint needs_adaptive_fields check (
    (nature = 'bien' and quantity is not null and quantity > 0
      and unit is not null and char_length(btrim(unit)) between 1 and 40
      and service_mode is null and service_scope is null and start_date is null and end_date is null)
    or
    (nature = 'servicio' and service_mode is not null and service_mode in ('presencial', 'remoto', 'hibrido')
      and service_scope is not null and char_length(btrim(service_scope)) between 10 and 2000
      and quantity is null and unit is null and delivery_date is null
      and (end_date is null or (start_date is not null and end_date >= start_date)))
  ),
  constraint needs_closed_timestamp check ((status = 'cerrada') = (closed_at is not null))
);

create index needs_owner_created_idx on public.needs(owner_id, created_at desc, id desc);
create index needs_status_created_idx on public.needs(status, created_at desc, id desc);
create index needs_sector_idx on public.needs(sector_id);
create index provider_classifications_sector_idx on public.provider_classifications(sector_id);

create function public.validate_provider_classification() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = new.profile_id and role in ('proveedor', 'socio')) then
    raise exception 'Solo proveedores y socios pueden guardar una clasificación.' using errcode = '23514';
  end if;
  if not exists (select 1 from public.sectors where id = new.sector_id and active) then
    raise exception 'Selecciona un rubro activo.' using errcode = '23514';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger validate_provider_classification before insert or update
on public.provider_classifications for each row execute function public.validate_provider_classification();

create function public.validate_need() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if old.status = 'cerrada' then
      raise exception 'Una necesidad cerrada no se puede editar ni reabrir.' using errcode = '23514';
    end if;
    if new.owner_id <> old.owner_id or new.id <> old.id or new.created_at <> old.created_at then
      raise exception 'No se puede cambiar el autor ni la identidad de la necesidad.' using errcode = '23514';
    end if;
  end if;
  -- Allow closing an old need even if its catalog entry has since been disabled.
  if new.status <> 'cerrada' and not exists (select 1 from public.sectors where id = new.sector_id and active) then
    raise exception 'Selecciona un rubro activo.' using errcode = '23514';
  end if;
  new.updated_at := clock_timestamp();
  new.closed_at := case when new.status = 'cerrada' then clock_timestamp() else null end;
  return new;
end;
$$;

create trigger validate_need before insert or update on public.needs
for each row execute function public.validate_need();

alter table public.sectors enable row level security;
alter table public.provider_classifications enable row level security;
alter table public.needs enable row level security;

revoke all on public.sectors, public.provider_classifications, public.needs from public, anon, authenticated;
grant select on public.sectors, public.provider_classifications, public.needs to authenticated;
grant insert (profile_id, nature, sector_id), update (nature, sector_id) on public.provider_classifications to authenticated;
grant insert (owner_id, title, description, nature, sector_id, country, region, city,
  budget_min, budget_max, currency, quantity, unit, delivery_date, service_mode, service_scope, start_date, end_date)
  on public.needs to authenticated;
grant update (title, description, nature, sector_id, country, region, city,
  budget_min, budget_max, currency, quantity, unit, delivery_date, service_mode, service_scope, start_date, end_date, status)
  on public.needs to authenticated;
grant all on public.sectors, public.provider_classifications, public.needs to service_role;
revoke all on function public.validate_provider_classification(), public.validate_need() from public, anon, authenticated;

create policy sectors_read on public.sectors for select to authenticated using (true);
create policy classifications_read on public.provider_classifications for select to authenticated using (true);
create policy classifications_insert_own on public.provider_classifications for insert to authenticated
with check (profile_id = (select auth.uid()));
create policy classifications_update_own on public.provider_classifications for update to authenticated
using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

create policy needs_read on public.needs for select to authenticated
using (status = 'abierta' or owner_id = (select auth.uid()));
create policy needs_insert_own on public.needs for insert to authenticated
with check (owner_id = (select auth.uid()) and status = 'abierta');
create policy needs_update_own on public.needs for update to authenticated
using (owner_id = (select auth.uid()) and status = 'abierta')
with check (owner_id = (select auth.uid()));

notify pgrst, 'reload schema';
commit;
