import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { createClient } from '@supabase/supabase-js'
import { fetchRecommendations, recommendationReasons } from '../src/lib/recommendations.js'

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

test('RPC: filtros, coincidencias, compatibilidad y permisos en PostgreSQL', async t => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      grant usage on schema public, auth to authenticated, anon, service_role;
    `)
    await db.exec(await readFile(new URL('fixtures/recommendations-schema.sql', import.meta.url), 'utf8'))
    await db.exec(`
      grant select on all tables in schema public to authenticated;
      alter table public.user_tag_scores enable row level security;
      create policy own_scores on public.user_tag_scores for select to authenticated using (user_id = auth.uid());
      alter table public.posts enable row level security;
      create policy visible_posts on public.posts for select to authenticated using (title <> 'Oculto por RLS');
    `)
    for (let i = 1; i <= 7; i++) {
      await db.query('insert into profiles(id,full_name,role) values ($1,$2,$3)', [uuid(i), `Empresa ${i}`, i === 1 || i === 7 ? 'cliente' : (i === 4 ? 'socio' : 'proveedor')])
    }
    await db.exec("insert into sectors(id,name,active) values ('tecnologia','Tecnología y software',true), ('empaque','Empaque y embalaje',true), ('inactivo','Inactivo',false)")
    for (const [owner, nature, sector] of [[1, 'bien', 'tecnologia'], [2, 'bien', 'tecnologia'], [3, 'servicio', 'tecnologia'], [4, 'ambos', 'tecnologia'], [5, 'bien', 'empaque'], [6, 'bien', 'inactivo']]) {
      await db.query('insert into provider_classifications(profile_id,nature,sector_id) values ($1,$2,$3)', [uuid(owner), nature, sector])
    }
    for (let i = 1; i <= 9; i++) {
      await db.query('insert into posts(id,author_id,title,description) values ($1,$2,$3,$4)', [uuid(100 + i), uuid(i <= 7 ? i : 2), i === 9 ? 'Oculto por RLS' : `Publicación ${i}`, 'Descripción'])
    }
    await db.query('insert into tags(id,name) values ($1,$2),($3,$4)', [uuid(201), 'software', uuid(202), 'local'])
    await db.query('insert into post_tags(post_id,tag_id) values ($1,$2),($1,$3),($4,$3)', [uuid(102), uuid(201), uuid(202), uuid(103)])
    await db.query('insert into user_tag_scores(user_id,tag_id,score) values ($1,$2,3),($1,$3,-1),($4,$2,999)', [uuid(1), uuid(201), uuid(202), uuid(7)])
    await db.query('insert into reactions(post_id,user_id,interested) values ($1,$2,false)', [uuid(108), uuid(1)])
    const migration = await readFile(new URL('../supabase/migrations/202611030001_recommend_posts_filters.sql', import.meta.url), 'utf8')
    await db.exec(migration)
    await db.exec(migration) // repetible sin borrar la variante anterior
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uuid(1)])
    await db.exec('set role authenticated')
    const call = async (nature = null, sector = null, limit = 50, excluded = [], roles = null, minimum = -1) =>
      (await db.query('select * from public.recommend_posts($1::text,$2::text,$3::integer,$4::uuid[],$5::text[],$6::numeric)', [nature, sector, limit, excluded, roles, minimum])).rows
    const ids = rows => rows.map(row => row.id).toSorted()

    await t.test('Sin filtros conserva candidatos y excluye propios, rechazados y ocultos por RLS', async () => {
      assert.deepEqual(ids(await call()), [102, 103, 104, 105, 106, 107].map(value => uuid(value)))
      const legacy = await db.query('select * from public.recommend_posts(p_limit => 50)')
      assert.deepEqual(ids(legacy.rows), ids(await call()))
    })
    await t.test('Naturaleza acepta ambos; rubro y naturaleza se combinan con AND', async () => {
      assert.deepEqual(ids(await call('bien', 'tecnologia')), [102, 104].map(value => uuid(value)))
      assert.deepEqual(ids(await call('servicio', 'tecnologia')), [103, 104].map(value => uuid(value)))
      assert.deepEqual(ids(await call('ambos', 'tecnologia')), [uuid(104)])
      assert.deepEqual(ids(await call(null, 'empaque')), [uuid(105)])
      assert.deepEqual(ids(await call('bien')), [102, 104, 105, 106].map(value => uuid(value)))
    })
    await t.test('Respuestas incluyen coincidencias reales, todas las etiquetas y solo puntajes del usuario', async () => {
      const post = (await call('bien', 'tecnologia')).find(row => row.id === uuid(102))
      assert.equal(Number(post.affinity), 2)
      assert.equal(post.profiles.full_name, 'Empresa 2')
      assert.deepEqual(post.recommendation, { nature: 'bien', sector_id: 'tecnologia', sector_name: 'Tecnología y software', requested_nature: 'bien', matched_nature: true, matched_sector: true })
      assert.equal(post.post_tags.length, 2)
      assert.deepEqual(post.post_tags.map(row => row.tags.user_tag_scores[0].score).toSorted(), [-1, 3])
      const unclassified = (await call()).find(row => row.id === uuid(107))
      assert.equal(unclassified.recommendation.nature, null)
      assert.equal(unclassified.recommendation.matched_nature, false)
    })
    await t.test('Respeta rol, exclusiones, umbral de afinidad y límite', async () => {
      assert.deepEqual(ids(await call('bien', 'tecnologia', 50, [uuid(102)], ['proveedor'])), [])
      assert.deepEqual(ids(await call(null, null, 50, [], ['socio'])), [uuid(104)])
      assert.deepEqual(ids(await call(null, null, 50, [], null, 1)), [uuid(102)])
      assert.equal((await call(null, null, 1)).length, 1)
      assert.equal((await call(null, null, 0)).length, 0)
      assert.equal((await call(null, null, -4)).length, 0)
    })
    await t.test('Sin coincidencias devuelve vacío, sin fallback a otra clasificación', async () => {
      assert.deepEqual(await call('servicio', 'empaque'), [])
      assert.deepEqual(await call(null, 'inactivo'), [])
      assert.deepEqual(await call(null, 'inexistente'), [])
      await assert.rejects(call('invalido'), error => error.code === '22023')
    })
    await t.test('Invocación anónima no permitida; sesión sin uid no recibe publicaciones', async () => {
      await db.exec('reset role; set role anon')
      await assert.rejects(call(), error => error.code === '42501')
      await db.exec('reset role')
      await db.query("select set_config('request.jwt.claim.sub', '', false)")
      await db.exec('set role authenticated')
      assert.deepEqual(await call(), [])
    })
  } finally {
    await db.close()
  }
})

function mockClient(responses, calls) {
  return createClient('https://example.supabase.co', 'test-public-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url, options) => {
      calls.push({ url: String(url), body: JSON.parse(options.body), signal: options.signal })
      const next = responses.shift()
      return Response.json(next.body, { status: next.status || 200, headers: { 'Content-Type': 'application/json' } })
    } },
  })
}

test('SDK: envía filtros y consume los JSON de la RPC sin joins adicionales', async () => {
  const calls = []
  const row = { id: 'demo', recommendation: { matched_sector: true }, post_tags: [] }
  const client = mockClient([{ body: [row] }], calls)
  assert.deepEqual(await fetchRecommendations(client, { nature: 'bien', sectorId: 'empaque', roles: ['proveedor', 'socio'], excludeIds: [uuid(102)], limit: 1 }), [row])
  assert.deepEqual(calls[0].body, { p_limit: 1, p_exclude: [uuid(102)], p_roles: ['proveedor', 'socio'], p_nature: 'bien', p_sector_id: 'empaque' })
  assert.equal(new URL(calls[0].url).searchParams.get('select'), '*')
})

test('SDK: despliegue pendiente conserva el feed anterior solo si no se pidieron filtros', async () => {
  const missing = { status: 404, body: { code: 'PGRST202', message: 'Missing function' } }
  const calls = []
  await fetchRecommendations(mockClient([missing, { body: [] }], calls))
  assert.equal(calls.length, 2)
  assert.ok(!('p_nature' in calls[1].body))
  const filteredCalls = []
  await assert.rejects(fetchRecommendations(mockClient([missing], filteredCalls), { sectorId: 'empaque' }), error => /todavía no están habilitados/.test(error.userMessage))
  assert.equal(filteredCalls.length, 1)
  const noMatches = []
  assert.deepEqual(await fetchRecommendations(mockClient([{ body: [] }], noMatches), { nature: 'bien' }), [])
  assert.equal(noMatches.length, 1)
})

test('Explicaciones: distinguen filtros, etiquetas y exploración sin inventar coincidencias', () => {
  assert.deepEqual(recommendationReasons({}), [])
  const post = { recommendation: { matched_nature: true, requested_nature: 'servicio', nature: 'ambos', matched_sector: true, sector_name: 'Tecnología y software' }, post_tags: [{ tags: { name: 'software', user_tag_scores: [{ score: 3 }] } }, { tags: { name: 'local', user_tag_scores: [{ score: -1 }] } }] }
  assert.deepEqual(recommendationReasons(post), ['La empresa ofrece servicios.', 'Su rubro es Tecnología y software.', 'Etiquetas afines a tus intereses: software.'])
  assert.match(recommendationReasons({ recommendation: { matched_nature: false, matched_sector: false }, post_tags: [] })[0], /todavía no hay coincidencias/)
})
