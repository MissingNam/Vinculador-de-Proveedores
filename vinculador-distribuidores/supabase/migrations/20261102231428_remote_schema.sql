SET local check_function_bodies = off;

CREATE TABLE "public"."needs" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "owner_id"      uuid                     NOT NULL,
  "title"         text                     NOT NULL,
  "description"   text                     NOT NULL,
  "nature"        text                     NOT NULL,
  "sector_id"     text                     NOT NULL,
  "country"       text                     NOT NULL,
  "region"        text                     NOT NULL,
  "city"          text                     NOT NULL,
  "budget_min"    numeric(14,2)            NOT NULL,
  "budget_max"    numeric(14,2)            NOT NULL,
  "currency"      text                     NOT NULL,
  "quantity"      numeric(14,3),
  "unit"          text,
  "delivery_date" date,
  "service_mode"  text,
  "service_scope" text,
  "start_date"    date,
  "end_date"      date,
  "status"        text                     NOT NULL DEFAULT 'abierta'::text,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "closed_at"     timestamp with time zone,
  CONSTRAINT "needs_adaptive_fields" CHECK ((((nature = 'bien'::text) AND (quantity IS NOT NULL) AND (quantity > (0)::numeric) AND (unit IS
    NOT NULL) AND ((char_length(btrim(unit)) >= 1) AND (char_length(btrim(unit)) <= 40)) AND (service_mode IS NULL) AND (service_scope IS NULL) AND (start_date IS NULL) AND
    (end_date IS NULL)) OR ((nature = 'servicio'::text) AND (service_mode IS
    NOT NULL) AND (service_mode = ANY (ARRAY['presencial'::text, 'remoto'::text, 'hibrido'::text])) AND (service_scope IS
    NOT NULL) AND ((char_length(btrim(service_scope)) >= 10) AND (char_length(btrim(service_scope)) <= 2000)) AND (quantity IS NULL) AND (unit IS NULL) AND (delivery_date IS NULL)
    AND ((end_date IS NULL) OR ((start_date IS NOT NULL) AND (end_date >= start_date)))))),
  CONSTRAINT "needs_budget_min_check" CHECK ((budget_min >= (0)::numeric)),
  CONSTRAINT "needs_check" CHECK (((budget_max > (0)::numeric) AND (budget_max >= budget_min))),
  CONSTRAINT "needs_city_check" CHECK (((char_length(btrim(city)) >= 2) AND (char_length(btrim(city)) <= 100))),
  CONSTRAINT "needs_closed_timestamp" CHECK (((status = 'cerrada'::text) = (closed_at IS NOT NULL))),
  CONSTRAINT "needs_country_check" CHECK (((char_length(btrim(country)) >= 2) AND (char_length(btrim(country)) <= 80))),
  CONSTRAINT "needs_currency_check" CHECK ((currency = ANY (ARRAY['MXN'::text, 'USD'::text]))),
  CONSTRAINT "needs_description_check" CHECK (((char_length(btrim(description)) >= 10) AND (char_length(btrim(description)) <= 4000))),
  CONSTRAINT "needs_nature_check" CHECK ((nature = ANY (ARRAY['bien'::text, 'servicio'::text]))),
  CONSTRAINT "needs_pkey" PRIMARY KEY (id),
  CONSTRAINT "needs_region_check" CHECK (((char_length(btrim(region)) >= 2) AND (char_length(btrim(region)) <= 100))),
  CONSTRAINT "needs_status_check" CHECK ((status = ANY (ARRAY['abierta'::text, 'cerrada'::text]))),
  CONSTRAINT "needs_title_check" CHECK (((char_length(btrim(title)) >= 5) AND (char_length(btrim(title)) <= 120)))
);

ALTER TABLE "public"."needs"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."needs" FROM "anon";

CREATE TABLE "public"."post_tags" (
  "post_id" uuid NOT NULL,
  "tag_id"  uuid NOT NULL,
  CONSTRAINT "post_tags_pkey" PRIMARY KEY (post_id, tag_id)
);

ALTER TABLE "public"."post_tags"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."posts" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "author_id"   uuid                     NOT NULL,
  "title"       text                     NOT NULL,
  "description" text,
  "created_at"  timestamp with time zone DEFAULT now(),
  "image_url"   text,
  CONSTRAINT "posts_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."posts"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."profile_links" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "profile_id" uuid                     NOT NULL,
  "label"      text,
  "url"        text                     NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "profile_links_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."profile_links"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."profile_tags" (
  "profile_id" uuid NOT NULL,
  "tag_id"     uuid NOT NULL,
  CONSTRAINT "profile_tags_pkey" PRIMARY KEY (profile_id, tag_id)
);

ALTER TABLE "public"."profile_tags"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."profiles" (
  "id"         uuid                     NOT NULL,
  "full_name"  text,
  "role"       text                     NOT NULL,
  "bio"        text,
  "avatar_url" text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id),
  CONSTRAINT "profiles_role_check" CHECK ((role = ANY (ARRAY['proveedor'::text, 'cliente'::text, 'socio'::text])))
);

ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."provider_classifications" (
  "profile_id" uuid                     NOT NULL,
  "nature"     text                     NOT NULL,
  "sector_id"  text                     NOT NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "provider_classifications_nature_check" CHECK ((nature = ANY (ARRAY['bien'::text, 'servicio'::text, 'ambos'::text]))),
  CONSTRAINT "provider_classifications_pkey" PRIMARY KEY (profile_id)
);

ALTER TABLE "public"."provider_classifications"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."provider_classifications" FROM "anon";

CREATE TABLE "public"."reactions" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "post_id"    uuid                     NOT NULL,
  "user_id"    uuid                     NOT NULL,
  "interested" boolean                  NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "reactions_pkey" PRIMARY KEY (id),
  CONSTRAINT "reactions_post_id_user_id_key" UNIQUE (post_id, user_id)
);

ALTER TABLE "public"."reactions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."sectors" (
  "id"         text    NOT NULL,
  "name"       text    NOT NULL,
  "active"     boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  CONSTRAINT "sectors_name_check" CHECK (((char_length(btrim(name)) >= 2) AND (char_length(btrim(name)) <= 100))),
  CONSTRAINT "sectors_name_key" UNIQUE (name),
  CONSTRAINT "sectors_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."sectors"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."sectors" FROM "anon";

CREATE TABLE "public"."tags" (
  "id"   uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  CONSTRAINT "tags_name_key" UNIQUE (name),
  CONSTRAINT "tags_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."tags"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."user_tag_scores" (
  "user_id"    uuid                     NOT NULL,
  "tag_id"     uuid                     NOT NULL,
  "score"      integer                  NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "user_tag_scores_pkey" PRIMARY KEY (user_id, tag_id)
);

ALTER TABLE "public"."user_tag_scores"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.affinity (
  p public.posts
)
  RETURNS numeric
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
  AS $function$
  select coalesce(
    sum(s.score * abs(s.score))::numeric / nullif(sum(abs(s.score)), 0),
    0
  )
  from post_tags pt
  join user_tag_scores s on s.tag_id = pt.tag_id and s.user_id = auth.uid()
  where pt.post_id = p.id;
$function$;

CREATE OR REPLACE FUNCTION public.apply_reaction_to_tag_scores()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  new_val int;
  old_val int := 0;
  delta int;
begin
  new_val := case when new.interested then 1 else -1 end;

  if tg_op = 'UPDATE' then
    old_val := case when old.interested then 1 else -1 end;
  end if;

  delta := new_val - old_val;
  if delta = 0 then
    return new;
  end if;

  insert into user_tag_scores (user_id, tag_id, score)
  select new.user_id, pt.tag_id, delta
  from post_tags pt
  where pt.post_id = new.post_id
  on conflict (user_id, tag_id)
  do update set score = user_tag_scores.score + excluded.score,
                updated_at = now();

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.recommend_posts (
  p_limit     integer DEFAULT 1,
  p_exclude   uuid[]  DEFAULT '{}'::uuid[],
  p_roles     text[]  DEFAULT NULL::text[],
  p_min_score numeric DEFAULT '-1'::integer
)
  RETURNS SETOF public.posts
  LANGUAGE sql
  SET search_path TO 'public'
  AS $function$
  with my_scores as (
    select tag_id, score
    from user_tag_scores
    where user_id = auth.uid()
  ),
  scored as (
    select
      pt.post_id,
      -- promedio ponderado: cada etiqueta pesa |puntaje|
      coalesce(
        sum(s.score * abs(s.score))::numeric / nullif(sum(abs(s.score)), 0),
        0
      ) as affinity
    from post_tags pt
    join my_scores s on s.tag_id = pt.tag_id
    group by pt.post_id
  )
  select p.*
  from posts p
  join profiles pr on pr.id = p.author_id
  left join scored sc on sc.post_id = p.id
  where p.author_id <> auth.uid()                         -- no recomendar tus propios posts
    and coalesce(sc.affinity, 0) >= p_min_score
    and not (p.id = any(coalesce(p_exclude, '{}')))       -- los que ya están en la ventana
    and (p_roles is null or pr.role = any(p_roles))       -- filtro de rol (null = sin filtro)
    and not exists (                                      -- los que marcaste "No me interesa"
      select 1 from reactions r
      where r.post_id = p.id
        and r.user_id = auth.uid()
        and r.interested = false
    )
  order by random()
  limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
  AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_need()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."validate_need"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.validate_provider_classification()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."validate_provider_classification"() FROM PUBLIC, "anon", "authenticated";

ALTER TABLE "public"."post_tags"
  ADD CONSTRAINT "post_tags_post_id_fkey" FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."needs"
  ADD CONSTRAINT "needs_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."posts"
  ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."profile_links"
  ADD CONSTRAINT "profile_links_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."profile_tags"
  ADD CONSTRAINT "profile_tags_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."provider_classifications"
  ADD CONSTRAINT "provider_classifications_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."reactions"
  ADD CONSTRAINT "reactions_post_id_fkey" FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;

ALTER TABLE "public"."reactions"
  ADD CONSTRAINT "reactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."needs"
  ADD CONSTRAINT "needs_sector_id_fkey" FOREIGN KEY (sector_id) REFERENCES public.sectors(id);

ALTER TABLE "public"."provider_classifications"
  ADD CONSTRAINT "provider_classifications_sector_id_fkey" FOREIGN KEY (sector_id) REFERENCES public.sectors(id);

ALTER TABLE "public"."post_tags"
  ADD CONSTRAINT "post_tags_tag_id_fkey" FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;

ALTER TABLE "public"."profile_tags"
  ADD CONSTRAINT "profile_tags_tag_id_fkey" FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;

ALTER TABLE "public"."user_tag_scores"
  ADD CONSTRAINT "user_tag_scores_tag_id_fkey" FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;

ALTER TABLE "public"."user_tag_scores"
  ADD CONSTRAINT "user_tag_scores_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX needs_owner_created_idx ON public.needs USING btree (owner_id, created_at DESC, id DESC);

CREATE INDEX needs_sector_idx ON public.needs USING btree (sector_id);

CREATE INDEX needs_status_created_idx ON public.needs USING btree (status, created_at DESC, id DESC);

CREATE INDEX provider_classifications_sector_idx ON public.provider_classifications USING btree (sector_id);

CREATE TRIGGER validate_need
  BEFORE INSERT OR UPDATE ON public.needs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_need();

CREATE TRIGGER validate_provider_classification
  BEFORE INSERT OR UPDATE ON public.provider_classifications
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_provider_classification();

CREATE TRIGGER trg_reactions_tag_scores
  AFTER INSERT OR UPDATE ON public.reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_reaction_to_tag_scores();

CREATE POLICY "needs_insert_own" ON "public"."needs"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) AND (status = 'abierta'::text)));

CREATE POLICY "needs_read" ON "public"."needs"
  FOR SELECT
  TO "authenticated"
  USING (((status = 'abierta'::text) OR (owner_id = ( SELECT auth.uid() AS uid))));

CREATE POLICY "needs_update_own" ON "public"."needs"
  FOR UPDATE
  TO "authenticated"
  USING (((owner_id = ( SELECT auth.uid() AS uid)) AND (status = 'abierta'::text)))
  WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "post_tags creables por autenticados" ON "public"."post_tags"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (true);

CREATE POLICY "post_tags visibles para autenticados" ON "public"."post_tags"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "Los posts son visibles para usuarios autenticados" ON "public"."posts"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "Los usuarios pueden borrar sus propios posts" ON "public"."posts"
  FOR DELETE
  TO "authenticated"
  USING ((auth.uid() = author_id));

CREATE POLICY "Los usuarios pueden crear sus propios posts" ON "public"."posts"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((auth.uid() = author_id));

CREATE POLICY "Los usuarios pueden editar sus propios posts" ON "public"."posts"
  FOR UPDATE
  TO "authenticated"
  USING ((auth.uid() = author_id));

CREATE POLICY "Los usuarios gestionan sus propios profile_links" ON "public"."profile_links"
  FOR ALL
  TO "authenticated"
  USING ((auth.uid() = profile_id))
  WITH CHECK ((auth.uid() = profile_id));

CREATE POLICY "profile_links visibles para autenticados" ON "public"."profile_links"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "Los usuarios gestionan sus propios profile_tags" ON "public"."profile_tags"
  FOR ALL
  TO "authenticated"
  USING ((auth.uid() = profile_id))
  WITH CHECK ((auth.uid() = profile_id));

CREATE POLICY "profile_tags visibles para autenticados" ON "public"."profile_tags"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "Los perfiles son visibles para usuarios autenticados" ON "public"."profiles"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "Los usuarios pueden crear su propio perfil" ON "public"."profiles"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((auth.uid() = id));

CREATE POLICY "Los usuarios pueden editar su propio perfil" ON "public"."profiles"
  FOR UPDATE
  TO "authenticated"
  USING ((auth.uid() = id));

CREATE POLICY "classifications_insert_own" ON "public"."provider_classifications"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((profile_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "classifications_read" ON "public"."provider_classifications"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "classifications_update_own" ON "public"."provider_classifications"
  FOR UPDATE
  TO "authenticated"
  USING ((profile_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((profile_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Los usuarios gestionan sus propias reacciones" ON "public"."reactions"
  FOR ALL
  TO "authenticated"
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Reacciones visibles para autenticados" ON "public"."reactions"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "sectors_read" ON "public"."sectors"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "Tags creables por autenticados" ON "public"."tags"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (true);

CREATE POLICY "Tags visibles para autenticados" ON "public"."tags"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "Cada usuario ve sus propios puntajes" ON "public"."user_tag_scores"
  FOR SELECT
  TO "authenticated"
  USING ((auth.uid() = user_id));

CREATE POLICY "Avatares son públicos" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING ((bucket_id = 'avatars'::text));

CREATE POLICY "Imágenes de posts son públicas" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING ((bucket_id = 'post-images'::text));

CREATE POLICY "Los usuarios pueden actualizar su propio avatar" ON "storage"."objects"
  FOR UPDATE
  TO "authenticated"
  USING (((bucket_id = 'avatars'::text) AND (OWNER = auth.uid())));

CREATE POLICY "Los usuarios pueden borrar su propio avatar" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id = 'avatars'::text) AND (OWNER = auth.uid())));

CREATE POLICY "Los usuarios pueden borrar sus propias imágenes" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id = 'post-images'::text) AND (OWNER = auth.uid())));

CREATE POLICY "Usuarios autenticados pueden subir avatares" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((bucket_id = 'avatars'::text));

CREATE POLICY "Usuarios autenticados pueden subir imágenes" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((bucket_id = 'post-images'::text));

CREATE EVENT TRIGGER "ensure_rls"
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION "public"."rls_auto_enable"();

GRANT EXECUTE ON FUNCTION "public"."affinity"(public.posts) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."affinity"(public.posts) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."affinity"(public.posts) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."affinity"(public.posts) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."apply_reaction_to_tag_scores"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."apply_reaction_to_tag_scores"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."apply_reaction_to_tag_scores"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."apply_reaction_to_tag_scores"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."recommend_posts"(integer, uuid[], text[], numeric) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."recommend_posts"(integer, uuid[], text[], numeric) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."recommend_posts"(integer, uuid[], text[], numeric) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."recommend_posts"(integer, uuid[], text[], numeric) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."validate_need"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."validate_need"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."validate_need"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."validate_provider_classification"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."validate_provider_classification"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."validate_provider_classification"() TO "service_role";

REVOKE ALL ON TABLE "public"."needs" FROM "authenticated";

REVOKE ALL ("budget_max") ON TABLE "public"."needs" FROM "authenticated";

GRANT INSERT ("budget_max"), UPDATE ("budget_max") ON TABLE "public"."needs" TO "authenticated";

REVOKE ALL ("budget_min") ON TABLE "public"."needs" FROM "authenticated";

GRANT INSERT ("budget_min"), UPDATE ("budget_min") ON TABLE "public"."needs" TO "authenticated";

REVOKE ALL ("city") ON TABLE "public"."needs" FROM "authenticated";

GRANT INSERT ("city"), UPDATE ("city") ON TABLE "public"."needs" TO "authenticated";

REVOKE ALL ("country") ON TABLE "public"."needs" FROM "authenticated";

GRANT INSERT ("country"), UPDATE ("country") ON TABLE "public"."needs" TO "authenticated";

REVOKE ALL ("currency") ON TABLE "public"."needs" FROM "authenticated";

GRANT INSERT ("currency"), UPDATE ("currency") ON TABLE "public"."needs" TO "authenticated";

REVOKE ALL ("delivery_date") ON TABLE "public"."needs" FROM "authenticated";

GRANT INSERT ("delivery_date"), UPDATE ("delivery_date") ON TABLE "public"."needs" TO "authenticated";

REVOKE ALL ("description") ON TABLE "public"."needs" FROM "authenticated";

GRANT INSERT ("description"), UPDATE ("description") ON TABLE "public"."needs" TO "authenticated";

REVOKE ALL ("end_date") ON TABLE "public"."needs" FROM "authenticated";

GRANT INSERT ("end_date"), UPDATE ("end_date") ON TABLE "public"."needs" TO "authenticated";

REVOKE ALL ("nature") ON TABLE "public"."needs" FROM "authenticated";

GRANT INSERT ("nature"), UPDATE ("nature") ON TABLE "public"."needs" TO "authenticated";

REVOKE ALL ("owner_id") ON TABLE "public"."needs" FROM "authenticated";

GRANT INSERT ("owner_id") ON TABLE "public"."needs" TO "authenticated";

REVOKE ALL ("quantity") ON TABLE "public"."needs" FROM "authenticated";

GRANT INSERT ("quantity"), UPDATE ("quantity") ON TABLE "public"."needs" TO "authenticated";

REVOKE ALL ("region") ON TABLE "public"."needs" FROM "authenticated";

GRANT INSERT ("region"), UPDATE ("region") ON TABLE "public"."needs" TO "authenticated";

REVOKE ALL ("sector_id") ON TABLE "public"."needs" FROM "authenticated";

GRANT INSERT ("sector_id"), UPDATE ("sector_id") ON TABLE "public"."needs" TO "authenticated";

REVOKE ALL ("service_mode") ON TABLE "public"."needs" FROM "authenticated";

GRANT INSERT ("service_mode"), UPDATE ("service_mode") ON TABLE "public"."needs" TO "authenticated";

REVOKE ALL ("service_scope") ON TABLE "public"."needs" FROM "authenticated";

GRANT INSERT ("service_scope"), UPDATE ("service_scope") ON TABLE "public"."needs" TO "authenticated";

REVOKE ALL ("start_date") ON TABLE "public"."needs" FROM "authenticated";

GRANT INSERT ("start_date"), UPDATE ("start_date") ON TABLE "public"."needs" TO "authenticated";

REVOKE ALL ("status") ON TABLE "public"."needs" FROM "authenticated";

GRANT UPDATE ("status") ON TABLE "public"."needs" TO "authenticated";

REVOKE ALL ("title") ON TABLE "public"."needs" FROM "authenticated";

GRANT INSERT ("title"), UPDATE ("title") ON TABLE "public"."needs" TO "authenticated";

REVOKE ALL ("unit") ON TABLE "public"."needs" FROM "authenticated";

GRANT INSERT ("unit"), UPDATE ("unit") ON TABLE "public"."needs" TO "authenticated";

GRANT SELECT ON TABLE "public"."needs" TO "authenticated";

REVOKE ALL ON TABLE "public"."needs" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."needs" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."needs" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."post_tags" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."post_tags" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."post_tags" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."post_tags" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."posts" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."posts" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."posts" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."posts" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profile_links" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."profile_links" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profile_links" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profile_links" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profile_tags" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."profile_tags" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profile_tags" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profile_tags" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."profiles" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "service_role";

REVOKE ALL ON TABLE "public"."provider_classifications" FROM "authenticated";

REVOKE ALL ("nature") ON TABLE "public"."provider_classifications" FROM "authenticated";

GRANT INSERT ("nature"), UPDATE ("nature") ON TABLE "public"."provider_classifications" TO "authenticated";

REVOKE ALL ("profile_id") ON TABLE "public"."provider_classifications" FROM "authenticated";

GRANT INSERT ("profile_id") ON TABLE "public"."provider_classifications" TO "authenticated";

REVOKE ALL ("sector_id") ON TABLE "public"."provider_classifications" FROM "authenticated";

GRANT INSERT ("sector_id"), UPDATE ("sector_id") ON TABLE "public"."provider_classifications" TO "authenticated";

GRANT SELECT ON TABLE "public"."provider_classifications" TO "authenticated";

REVOKE ALL ON TABLE "public"."provider_classifications" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."provider_classifications" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."provider_classifications" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."reactions" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."reactions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."reactions" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."reactions" TO "service_role";

REVOKE ALL ON TABLE "public"."sectors" FROM "authenticated";

GRANT SELECT ON TABLE "public"."sectors" TO "authenticated";

REVOKE ALL ON TABLE "public"."sectors" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."sectors" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."sectors" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tags" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."tags" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tags" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tags" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_tag_scores" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."user_tag_scores" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_tag_scores" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_tag_scores" TO "service_role";

