import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { canClassify, featureError, natureLabel } from '../src/lib/classification.js'
import { emptyNeed, needPayload, validateNeed } from '../src/lib/needs.js'
import { goodsNeed, serviceNeed } from './fixtures/classified-needs.js'

test('Formularios: datos completos y campos adaptativos', () => {
  assert.deepEqual(validateNeed(goodsNeed), {})
  assert.deepEqual(validateNeed(serviceNeed), {})
  assert.ok(Object.keys(validateNeed(emptyNeed())).length >= 7)
  const service = needPayload({ ...goodsNeed, ...serviceNeed, quantity: 500, unit: 'piezas', delivery_date: '2027-01-01' })
  assert.equal(service.quantity, null)
  assert.equal(service.unit, null)
  assert.equal(service.delivery_date, null)
  const goods = needPayload({ ...serviceNeed, ...goodsNeed, service_scope: 'Dato que quedó oculto', service_mode: 'remoto', start_date: '2027-01-01' })
  assert.equal(goods.service_scope, null)
  assert.equal(goods.service_mode, null)
  assert.equal(goods.start_date, null)
  assert.equal(needPayload({ ...goodsNeed, title: `  ${goodsNeed.title}  ` }).title, goodsNeed.title)
  assert.equal(canClassify('cliente'), false)
  assert.equal(canClassify('proveedor'), true)
  assert.equal(canClassify('socio'), true)
  assert.equal(natureLabel('ambos'), 'Bienes y servicios')
})

test('Formularios: presupuesto, cantidades, fechas y límites', () => {
  for (const [field, value] of [['budget_min', ''], ['budget_min', -1], ['budget_max', 0], ['budget_max', 100], ['budget_max', Infinity], ['budget_max', '12.345'], ['quantity', 0], ['quantity', '1.2345'], ['unit', ' '], ['sector_id', null], ['nature', 'ambos'], ['currency', 'ZZZ'], ['title', 'x'], ['description', 'x']]) {
    assert.ok(validateNeed({ ...goodsNeed, [field]: value })[field], `${field}=${value}`)
  }
  assert.ok(validateNeed({ ...goodsNeed, delivery_date: '2027-02-30' }).delivery_date)
  assert.ok(validateNeed({ ...serviceNeed, start_date: '2027-01-10', end_date: '2027-01-09' }).end_date)
  assert.ok(validateNeed({ ...serviceNeed, end_date: '2027-01-10' }).end_date)
  assert.ok(validateNeed({ ...serviceNeed, service_scope: 'corto' }).service_scope)
  assert.ok(validateNeed({ ...serviceNeed, service_mode: 'otro' }).service_mode)
  assert.throws(() => needPayload({ ...goodsNeed, quantity: -1 }))
  assert.match(featureError({ code: 'PGRST205' }), /todavía no está habilitada/)
  assert.match(featureError({ code: '42501' }), /permiso/)
})

test('Migración PostgreSQL: persistencia, validaciones y permisos por usuario', async t => {
  const db = new PGlite()
  const owner = '00000000-0000-4000-8000-000000000001'
  const other = '00000000-0000-4000-8000-000000000002'
  const client = '00000000-0000-4000-8000-000000000003'
  const partner = '00000000-0000-4000-8000-000000000004'
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      grant usage on schema public, auth to authenticated, anon, service_role;
      create table public.profiles(id uuid primary key, role text not null, full_name text);
      grant select on public.profiles to authenticated;
      insert into public.profiles values
        ('${owner}', 'proveedor', 'Proveedor de prueba A'),
        ('${other}', 'proveedor', 'Proveedor de prueba B'),
        ('${client}', 'cliente', 'Cliente de prueba'),
        ('${partner}', 'socio', 'Socio de prueba');
    `)
    const migration = await readFile(new URL('../supabase/migrations/202610190001_classification_needs.sql', import.meta.url), 'utf8')
    await db.exec(migration)
    const asUser = async id => {
      await db.exec('reset role')
      await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', id])
      await db.exec('set role authenticated')
    }
    const insertNeed = async (userId, form) => {
      const payload = { owner_id: userId, ...needPayload(form) }
      const keys = Object.keys(payload)
      return db.query(`insert into public.needs (${keys.join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')}) returning *`, Object.values(payload))
    }
    let goodsId
    let serviceId
    let originalTimestamp

    await t.test('Catálogo compartido y clasificaciones persistentes', async () => {
      await asUser(owner)
      assert.equal((await db.query('select * from public.sectors')).rows.length, 10)
      await db.query('insert into public.provider_classifications(profile_id,nature,sector_id) values ($1,$2,$3)', [owner, 'ambos', 'tecnologia'])
      await db.query('update public.provider_classifications set nature=$1 where profile_id=$2', ['servicio', owner])
      const row = (await db.query('select * from public.provider_classifications where profile_id=$1', [owner])).rows[0]
      assert.equal(row.nature, 'servicio')
      assert.equal(row.sector_id, 'tecnologia')
      await asUser(partner)
      await db.query('insert into public.provider_classifications(profile_id,nature,sector_id) values ($1,$2,$3)', [partner, 'bien', 'empaque'])
      await asUser(client)
      await assert.rejects(db.query('insert into public.provider_classifications(profile_id,nature,sector_id) values ($1,$2,$3)', [client, 'bien', 'empaque']))
    })

    await t.test('No se puede clasificar a otro usuario ni editar el catálogo', async () => {
      await asUser(other)
      assert.equal((await db.query('update public.provider_classifications set nature=$1 where profile_id=$2 returning *', ['bien', owner])).rows.length, 0)
      await assert.rejects(db.query('insert into public.provider_classifications(profile_id,nature,sector_id) values ($1,$2,$3)', [client, 'bien', 'empaque']))
      await assert.rejects(db.exec("insert into public.sectors(id,name) values ('intruso','Intruso')"))
      await assert.rejects(db.exec("update public.sectors set name='Modificado' where id='empaque'"))
      await assert.rejects(db.exec("delete from public.sectors where id='empaque'"))
    })

    await t.test('Crear y recuperar bienes y servicios; todas las cuentas pueden solicitar', async () => {
      await asUser(owner)
      const goods = (await insertNeed(owner, goodsNeed)).rows[0]
      goodsId = goods.id
      originalTimestamp = goods.updated_at
      assert.equal(goods.status, 'abierta')
      assert.equal(goods.closed_at, null)
      await asUser(client)
      serviceId = (await insertNeed(client, serviceNeed)).rows[0].id
      assert.equal((await db.query('select * from public.needs')).rows.length, 2)
      const service = (await db.query('select * from public.needs where id=$1', [serviceId])).rows[0]
      assert.equal(service.service_scope, serviceNeed.service_scope)
      assert.equal(service.quantity, null)
    })

    await t.test('RLS: otro usuario no puede editar, cerrar ni suplantar al autor', async () => {
      await asUser(other)
      assert.equal((await db.query("update public.needs set title='Título ajeno cambiado' where id=$1 returning id", [goodsId])).rows.length, 0)
      assert.equal((await db.query("update public.needs set status='cerrada' where id=$1 returning id", [goodsId])).rows.length, 0)
      await assert.rejects(insertNeed(owner, goodsNeed))
      await asUser(owner)
      await assert.rejects(db.query('update public.needs set owner_id=$1 where id=$2', [other, goodsId]))
      await assert.rejects(db.query('delete from public.needs where id=$1', [goodsId]))
    })

    await t.test('La base rechaza presupuestos, rubros y campos adaptativos inválidos', async () => {
      await asUser(owner)
      for (const query of [
        'update public.needs set budget_min=-1 where id=$1',
        'update public.needs set budget_max=1 where id=$1',
        "update public.needs set sector_id='no-existe' where id=$1",
        'update public.needs set quantity=null where id=$1',
        "update public.needs set service_scope='No corresponde a bienes' where id=$1",
        "update public.needs set title=' ' where id=$1",
      ]) {await assert.rejects(db.query(query, [goodsId]))}
      await asUser(client)
      await assert.rejects(db.query("update public.needs set service_mode=null where id=$1", [serviceId]))
      await assert.rejects(db.query("update public.needs set end_date='2027-02-02',start_date=null where id=$1", [serviceId]))
    })

    await t.test('Edición y protección contra formularios desactualizados', async () => {
      await asUser(owner)
      const result = await db.query('update public.needs set title=$1 where id=$2 and updated_at=$3 returning *', ['Cajas de cartón reforzadas', goodsId, originalTimestamp])
      assert.equal(result.rows.length, 1)
      assert.equal((await db.query('update public.needs set title=$1 where id=$2 and updated_at=$3 returning *', ['Edición antigua que no debe guardarse', goodsId, originalTimestamp])).rows.length, 0)
      assert.equal((await db.query('select title from public.needs where id=$1', [goodsId])).rows[0].title, 'Cajas de cartón reforzadas')
    })

    await t.test('Rubros desactivados no admiten registros nuevos, pero permiten cerrar los anteriores', async () => {
      await db.exec("reset role; update public.sectors set active=false where id='empaque'")
      await asUser(owner)
      await assert.rejects(insertNeed(owner, goodsNeed))
      await assert.rejects(db.query('update public.provider_classifications set sector_id=$1 where profile_id=$2', ['empaque', owner]))
      const closed = (await db.query("update public.needs set status='cerrada' where id=$1 returning *", [goodsId])).rows[0]
      assert.equal(closed.status, 'cerrada')
      assert.ok(closed.closed_at)
    })

    await t.test('Cierre definitivo e historial exclusivo del autor', async () => {
      await asUser(owner)
      assert.equal((await db.query('select * from public.needs where id=$1', [goodsId])).rows.length, 1)
      assert.equal((await db.query("update public.needs set status='abierta' where id=$1 returning id", [goodsId])).rows.length, 0)
      assert.equal((await db.query("update public.needs set title='No debe cambiar' where id=$1 returning id", [goodsId])).rows.length, 0)
      await asUser(other)
      assert.equal((await db.query('select * from public.needs where id=$1', [goodsId])).rows.length, 0)
      assert.equal((await db.query('select * from public.needs where id=$1', [serviceId])).rows.length, 1)
      await db.exec('reset role')
      await assert.rejects(db.query("update public.needs set status='abierta' where id=$1", [goodsId]))
    })

    await t.test('Usuarios sin sesión no tienen acceso', async () => {
      await db.exec('reset role; set role anon')
      for (const table of ['needs', 'sectors', 'provider_classifications']) {
        await assert.rejects(db.query(`select * from public.${table}`))
      }
      await assert.rejects(insertNeed(owner, goodsNeed))
    })
  } finally {
    await db.close()
  }
})
