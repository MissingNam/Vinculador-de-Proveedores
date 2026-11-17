import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { createClient } from '@supabase/supabase-js'
import { removePost, saveReaction, validatePost } from '../src/lib/offers.js'
import { searchPosts } from '../src/lib/postSearch.js'
import { routeAccess } from '../src/lib/routeAccess.js'
import { createHandler, safeWebResults } from '../supabase/functions/supplier-assistant/handler.js'

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
test('Ofertas: transacción, filtros, compatibilidad, RLS y cuota en PostgreSQL', async t => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      grant usage on schema public, auth to authenticated, anon, service_role;
    `)
    await db.exec(await readFile(new URL('fixtures/recommendations-schema.sql', import.meta.url), 'utf8'))
    // Políticas y FK del esquema compartido por el equipo, para las tablas ejercitadas.
    const schema = await readFile(new URL('../supabase/migrations/20261102231428_remote_schema.sql', import.meta.url), 'utf8')
    for (const policy of schema.matchAll(/CREATE POLICY[\s\S]*?;/g)) {
      if (/ON "public"\."(?:posts|tags|post_tags|reactions|sectors|profiles)"/.test(policy[0])) {await db.exec(policy[0])}
    }
    for (const table of ['posts', 'tags', 'post_tags', 'reactions', 'sectors', 'profiles']) {await db.exec(`alter table public.${table} enable row level security`)}
    await db.exec(`
      grant select,insert,update,delete on all tables in schema public to authenticated;
      alter table public.post_tags add foreign key(post_id) references public.posts(id) on delete cascade;
      alter table public.reactions add foreign key(post_id) references public.posts(id) on delete cascade;
      insert into sectors(id,name,active) values('tecnologia','Tecnología',true),('empaque','Empaque',true),('inactivo','Inactivo',false);
    `)
    for (let i = 1; i <= 3; i++) {
      await db.query('insert into auth.users values($1)', [uuid(i)])
      await db.query('insert into profiles(id,full_name,role) values($1,$2,$3)', [uuid(i), `Empresa ${i}`, i === 3 ? 'cliente' : 'proveedor'])
    }
    await db.query("insert into posts(id,author_id,title) values($1,$2,'Publicación anterior')", [uuid(100), uuid(1)])
    for (const name of ['202611030001_recommend_posts_filters.sql', '202611160001_offer_classification_assistant.sql', '202611160002_offer_recommendation_cards.sql']) {
      const sql = await readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8')
      await db.exec(sql)
      if (name.startsWith('20261116')) {await db.exec(sql)}
    }
    const asUser = async (n, guest = false) => {
      await db.exec('reset role')
      await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)", [uuid(n), JSON.stringify({ is_anonymous: guest })])
      await db.exec('set role authenticated')
    }
    const create = async (nature = 'bien', sector = 'empaque', tags = ['cartón']) =>
      (await db.query("select create_classified_post('Cajas industriales','Cajas para embalaje industrial',$1,$2,$3::text[],null) id", [nature, sector, tags])).rows[0].id
    const candidates = async (text = '', nature = null, sector = null) =>
      (await db.query('select * from candidate_offers($1,$2,$3,12)', [text,nature,sector])).rows
    await asUser(1)
    let postId
    await t.test('Guarda oferta y etiquetas únicas; no cambia la clasificación del perfil', async () => {
      postId = await create('bien','empaque',['cartón','cartón',' local '])
      const rows = await candidates('cartón industriales','bien','empaque')
      assert.equal(rows.length,1)
      assert.equal(rows[0].id,postId)
      assert.equal(rows[0].post_tags.length,2)
      assert.equal(rows[0].sectors.name,'Empaque')
      assert.equal((await db.query('select * from provider_classifications')).rows.length,0)
      assert.equal((await candidates()).some(row => row.id === uuid(100)),false)
    })
    await t.test('AND de palabras/naturaleza/rubro y entradas literales sin comodines', async () => {
      assert.equal((await candidates('cartón','servicio')).length,0)
      assert.equal((await candidates('cartón','bien','tecnologia')).length,0)
      assert.equal((await candidates('%')).length,0)
      assert.equal((await candidates('noexiste')).length,0)
      await assert.rejects(candidates('','ambos'), error => error.code === '22023')
    })
    await t.test('Error de etiqueta revierte post y tags; valida clasificación incluso sin RPC', async () => {
      const before = (await db.query('select count(*) n from posts')).rows[0].n
      await assert.rejects(create('bien','empaque',['nueva temporal','x'.repeat(51)]), error => error.code === '22023')
      assert.equal((await db.query('select count(*) n from posts')).rows[0].n,before)
      assert.equal((await db.query("select * from tags where name='nueva temporal'")).rows.length,0)
      await assert.rejects(create(null,null), error => error.code === '22023')
      await assert.rejects(create('bien','inactivo'), error => error.code === '22023')
      await assert.rejects(db.query("insert into posts(author_id,title) values($1,'Sin clasificar')",[uuid(1)]), error => error.code === '22023')
    })
    await t.test('Tarjetas recomendadas incluyen la clasificación propia sin romper el contrato anterior', async () => {
      await asUser(2)
      const rec = (await db.query('select * from recommend_posts(null::text,null::text,50)')).rows.find(row => row.id === postId)
      assert.equal(rec.recommendation.offer_nature,'bien')
      assert.equal(rec.recommendation.offer_sector_name,'Empaque')
      assert.equal((await db.query('select * from recommend_posts(p_limit => 50)')).rows.some(row => row.id === postId),true)
    })
    await t.test('Impide etiquetar/eliminar ofertas ajenas; invitado y anon no publican ni consumen cuota', async () => {
      await asUser(2)
      const tagId = (await db.query("select id from tags where name='cartón'")).rows[0].id
      await assert.rejects(db.query('insert into post_tags values($1,$2)',[postId,tagId]), error => error.code === '42501')
      assert.equal((await db.query('delete from posts where id=$1 returning id',[postId])).rows.length,0)
      await asUser(2,true)
      await assert.rejects(create(), error => error.code === '42501')
      await assert.rejects(db.query('select consume_assistant_quota()'), error => error.code === '42501')
      await db.exec('reset role; set role anon')
      await assert.rejects(candidates(), error => error.code === '42501')
    })
    await t.test('Cliente conserva publicaciones generales y no puede crear ofertas', async () => {
      await asUser(3)
      await assert.rejects(create(), error => error.code === '42501')
      assert.ok(await create(null,null,[]))
    })
    await t.test('Cuota de 10 consultas aislada por usuario y sin acceso directo a contadores', async () => {
      await asUser(1)
      for (let i=0;i<10;i++) {assert.equal((await db.query('select consume_assistant_quota() ok')).rows[0].ok,true)}
      assert.equal((await db.query('select consume_assistant_quota() ok')).rows[0].ok,false)
      await assert.rejects(db.query('delete from assistant_usage'), error => error.code === '42501')
      await asUser(2)
      assert.equal((await db.query('select consume_assistant_quota() ok')).rows[0].ok,true)
    })
    await t.test('Borrar oferta propia elimina sus relaciones sin recarga de página', async () => {
      await asUser(1)
      assert.equal((await db.query('delete from posts where id=$1 returning id',[postId])).rows.length,1)
      assert.equal((await db.query('select * from post_tags where post_id=$1',[postId])).rows.length,0)
    })
  } finally { await db.close() }
})

test('Validación y errores confirmados de guardar reacción y eliminar', async () => {
  const value = { title:' Oferta ',description:'Descripción suficiente', tags:[' local ','local'],nature:'bien',sectorId:'empaque' }
  assert.deepEqual(validatePost(value,true).p_tags,['local'])
  assert.throws(() => validatePost({...value,nature:null},true))
  const chain = result => new Proxy({}, { get: (_target,key) => key === 'then' ? Promise.resolve(result).then.bind(Promise.resolve(result)) : () => chain(result) })
  await assert.rejects(saveReaction({from:()=>chain({error:{code:'42501'}})},'post','user',true),/reacción/)
  await assert.rejects(removePost({from:()=>chain({data:[],error:null})},'post','user'),/eliminar/)
})

test('Búsqueda combina texto, etiqueta y clasificación en la petición real del SDK', async () => {
  let request
  const client = createClient('https://example.supabase.co','public-test-key',{global:{fetch:async (url) => {
    request = new URL(url)
    return new Response('[]',{headers:{'content-type':'application/json','content-range':'0-0/0'}})
  }}})
  await searchPosts(client,{text:'cartón',tag:'local',nature:'bien',sectorId:'empaque',page:2})
  assert.equal(request.searchParams.get('nature'),'eq.bien')
  assert.equal(request.searchParams.get('sector_id'),'eq.empaque')
  assert.equal(request.searchParams.get('selected_tags.tags.name'),'eq.local')
  assert.match(request.searchParams.get('or'),/cartón/)
  assert.equal(request.searchParams.get('offset'),'20')
})

test('Acceso directo: sesión ausente, invitado, perfil incompleto y usuario registrado', () => {
  for (const path of ['/publicar','/perfil','/asistente','/necesidades/nueva','/necesidades/123/editar']) {
    assert.equal(routeAccess({user:null},{path}),'/login')
    assert.equal(routeAccess({user:{},isGuest:true},{path}),'/')
    assert.equal(routeAccess({user:{},needsProfile:true},{path}),'/completar-perfil')
    assert.equal(routeAccess({user:{},needsProfile:false},{path}),true)
  }
  assert.equal(routeAccess({user:{},isGuest:true},{path:'/',meta:{guestOk:true}}),true)
  assert.equal(routeAccess({user:null},{path:'/login'}),true)
})

function assistantFixture({ user = {id:'u'}, secrets = {}, quota = true, fetchImpl, offers = [{ id:'p',title:'Cajas',description:'Cartón',nature:'bien',sectors:{name:'Empaque'} }] } = {}) {
  const calls = []
  const handler = createHandler({
    env: key => ({ SUPABASE_URL:'https://example.supabase.co', SUPABASE_ANON_KEY:'public', ...secrets })[key],
    createClient: () => ({auth:{getUser:async()=>({data:{user}})},rpc:async (name,args) => {calls.push({name,args});return {data:name==='candidate_offers'?offers:quota}}}),
    fetchImpl: fetchImpl || (()=>{throw new Error('No external call expected')}),
  })
  const request = (input, headers) =>
    handler(new Request('https://example.test',{method:'POST',headers:headers ?? {authorization:'Bearer token'},body:JSON.stringify(input ?? {query:'cajas'})}))
  return {request,calls}
}
test('Edge: rechaza sesiones ausentes, invitados, datos inválidos y exceso de cuota antes de APIs', async () => {
  assert.equal((await assistantFixture().request({query:'cajas'},{})).status,401)
  assert.equal((await assistantFixture({user:{is_anonymous:true}}).request()).status,403)
  assert.equal((await assistantFixture().request({query:'x'})).status,400)
  const limited = assistantFixture({quota:false,secrets:{TAVILY_API_KEY:'secret'}})
  assert.equal((await limited.request({query:'cajas',web:true})).status,429)
  assert.equal((await assistantFixture().request({query:'cajas'},{authorization:'Bearer token',origin:'https://unknown.test'})).status,403)
})
test('Edge: sin claves devuelve ofertas y aviso; falla externa no elimina coincidencias internas', async () => {
  const missing = await (await assistantFixture().request({query:'cajas',ai:true,web:true})).json()
  assert.equal(missing.offers.length,1); assert.equal(missing.warnings.length,2)
  const failed = await (await assistantFixture({secrets:{TAVILY_API_KEY:'secret'}}).request({query:'cajas',web:true})).json()
  assert.equal(failed.offers.length,1); assert.equal(failed.web.length,0); assert.equal(failed.warnings.length,1)
})
test('Edge: Tavily y Gemini reciben contratos correctos, citas y datos limitados; no filtra secretos', async () => {
  const outbound = []
  const fixture = assistantFixture({secrets:{TAVILY_API_KEY:'tavily-secret',GEMINI_API_KEY:'gemini-secret',GEMINI_MODEL:'test-model'},fetchImpl:async (url,options) => {
    outbound.push({url,options,body:JSON.parse(options.body)})
    return Response.json(url.includes('tavily')? {results:[{url:'https://supplier.test/catalog',title:'Cajas',content:'Catálogo'}]} : {candidates:[{content:{parts:[{text:'Compara O1 y W1.'}]}}]})
  }})
  const result = await (await fixture.request({query:'cajas',ai:true,web:true})).json()
  assert.equal(outbound.length,2)
  assert.equal(outbound[0].body.max_results,5)
  assert.equal(outbound[0].options.headers.Authorization,'Bearer tavily-secret')
  assert.equal(outbound[1].options.headers['x-goog-api-key'],'gemini-secret')
  assert.ok(outbound[1].body.systemInstruction)
  assert.equal(result.web[0].source,'supplier.test')
  assert.match(result.summary,/W1/)
  assert.doesNotMatch(JSON.stringify(result),/secret/)
})
test('Fuentes externas excluyen URLs ejecutables, credenciales y duplicados', () => {
  const rows = safeWebResults([{url:'javascript:alert(1)'},{url:'https://user:pass@example.com'},{url:'https://example.com'},{url:'https://example.com'}])
  assert.equal(rows.length,1)
})
