-- Las políticas RESTRICTIVE se combinan (AND) con las que ya tienes: no hace falta reescribirlas.
-- Solo afectan a escrituras; las lecturas del invitado siguen funcionando.
do $$
declare
  t text;
  not_anon constant text := $c$coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false$c$;
begin
  foreach t in array array[
    'profiles', 'posts', 'tags', 'post_tags', 'reactions',
    'profile_tags', 'profile_links', 'provider_classifications', 'needs'
  ] loop
    execute format('drop policy if exists "Invitados no insertan" on public.%I', t);
    execute format('create policy "Invitados no insertan" on public.%I as restrictive for insert to authenticated with check (%s)', t, not_anon);

    execute format('drop policy if exists "Invitados no actualizan" on public.%I', t);
    execute format('create policy "Invitados no actualizan" on public.%I as restrictive for update to authenticated using (%s)', t, not_anon);

    execute format('drop policy if exists "Invitados no borran" on public.%I', t);
    execute format('create policy "Invitados no borran" on public.%I as restrictive for delete to authenticated using (%s)', t, not_anon);
  end loop;
end $$;

-- Storage: ningún invitado sube, cambia ni borra archivos (post-images, avatars, etc.)
drop policy if exists "Invitados no suben archivos" on storage.objects;
create policy "Invitados no suben archivos" on storage.objects as restrictive for insert to authenticated
  with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

drop policy if exists "Invitados no actualizan archivos" on storage.objects;
create policy "Invitados no actualizan archivos" on storage.objects as restrictive for update to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

drop policy if exists "Invitados no borran archivos" on storage.objects;
create policy "Invitados no borran archivos" on storage.objects as restrictive for delete to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);