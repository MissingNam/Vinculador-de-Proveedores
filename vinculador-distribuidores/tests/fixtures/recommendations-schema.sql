-- Extracto de origin/Migrations, 20261102231428_remote_schema.sql. Solo para pruebas locales.
CREATE TABLE "public"."post_tags" (
  "post_id" uuid NOT NULL,
  "tag_id"  uuid NOT NULL,
  CONSTRAINT "post_tags_pkey" PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE "public"."posts" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "author_id"   uuid                     NOT NULL,
  "title"       text                     NOT NULL,
  "description" text,
  "created_at"  timestamp with time zone DEFAULT now(),
  "image_url"   text,
  CONSTRAINT "posts_pkey" PRIMARY KEY (id)
);

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

CREATE TABLE "public"."provider_classifications" (
  "profile_id" uuid                     NOT NULL,
  "nature"     text                     NOT NULL,
  "sector_id"  text                     NOT NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "provider_classifications_nature_check" CHECK ((nature = ANY (ARRAY['bien'::text, 'servicio'::text, 'ambos'::text]))),
  CONSTRAINT "provider_classifications_pkey" PRIMARY KEY (profile_id)
);

CREATE TABLE "public"."reactions" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "post_id"    uuid                     NOT NULL,
  "user_id"    uuid                     NOT NULL,
  "interested" boolean                  NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "reactions_pkey" PRIMARY KEY (id),
  CONSTRAINT "reactions_post_id_user_id_key" UNIQUE (post_id, user_id)
);

CREATE TABLE "public"."sectors" (
  "id"         text    NOT NULL,
  "name"       text    NOT NULL,
  "active"     boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  CONSTRAINT "sectors_name_check" CHECK (((char_length(btrim(name)) >= 2) AND (char_length(btrim(name)) <= 100))),
  CONSTRAINT "sectors_name_key" UNIQUE (name),
  CONSTRAINT "sectors_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."tags" (
  "id"   uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  CONSTRAINT "tags_name_key" UNIQUE (name),
  CONSTRAINT "tags_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."user_tag_scores" (
  "user_id"    uuid                     NOT NULL,
  "tag_id"     uuid                     NOT NULL,
  "score"      integer                  NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "user_tag_scores_pkey" PRIMARY KEY (user_id, tag_id)
);

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