create table if not exists public.profile_contacts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('telefono', 'correo', 'otro')),
  label text check (label is null or char_length(label) <= 60),
  value text not null check (char_length(btrim(value)) between 3 and 200),
  is_public boolean not null default false,          -- privado por defecto
  created_at timestamp with time zone not null default now()
);

create index if not exists profile_contacts_profile_id_idx on public.profile_contacts (profile_id);

alter table public.profile_contacts enable row level security;

-- LECTURA (las políticas permisivas se combinan con OR):
-- 1) el dueño ve todos los suyos, públicos o no
drop policy if exists "Dueño ve sus contactos" on public.profile_contacts;
create policy "Dueño ve sus contactos" on public.profile_contacts
  for select to authenticated using (auth.uid() = profile_id);

-- 2) los demás usuarios registrados solo ven los públicos (los invitados anónimos no ven ninguno)
drop policy if exists "Usuarios ven contactos públicos" on public.profile_contacts;
create policy "Usuarios ven contactos públicos" on public.profile_contacts
  for select to authenticated
  using (is_public and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

-- ESCRITURA: solo el dueño, sobre sus propias filas
drop policy if exists "Dueño crea sus contactos" on public.profile_contacts;
create policy "Dueño crea sus contactos" on public.profile_contacts
  for insert to authenticated with check (auth.uid() = profile_id);

drop policy if exists "Dueño edita sus contactos" on public.profile_contacts;
create policy "Dueño edita sus contactos" on public.profile_contacts
  for update to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists "Dueño borra sus contactos" on public.profile_contacts;
create policy "Dueño borra sus contactos" on public.profile_contacts
  for delete to authenticated using (auth.uid() = profile_id);

-- Invitados anónimos: nunca escriben (igual que en las demás tablas)
drop policy if exists "Invitados no insertan" on public.profile_contacts;
create policy "Invitados no insertan" on public.profile_contacts as restrictive
  for insert to authenticated with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

drop policy if exists "Invitados no actualizan" on public.profile_contacts;
create policy "Invitados no actualizan" on public.profile_contacts as restrictive
  for update to authenticated using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

drop policy if exists "Invitados no borran" on public.profile_contacts;
create policy "Invitados no borran" on public.profile_contacts as restrictive
  for delete to authenticated using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);