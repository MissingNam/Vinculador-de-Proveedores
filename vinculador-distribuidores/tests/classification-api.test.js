import assert from 'node:assert/strict'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { getClassification, saveClassification } from '../src/lib/classification.js'
import { closeNeed, listNeeds, saveNeed } from '../src/lib/needs.js'
import { goodsNeed, serviceNeed } from './fixtures/classified-needs.js'

// Exercise the real Supabase SDK request serialization without contacting a project.
function stubClient(rows = [], status = 200) {
  const calls = []
  const client = createClient('https://example.supabase.co', 'test-publishable-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url, options) => {
      calls.push({ url: new URL(url), options, body: options.body ? JSON.parse(options.body) : null })
      return Response.json(rows, { status, headers: { 'content-type': 'application/json', 'content-range': `0-0/${rows.length ?? 0}` } })
    } },
  })
  return { client, calls }
}

test('SDK: al crear una necesidad se limpia la rama oculta y no se aceptan autor/estado externos', async () => {
  const { client, calls } = stubClient([{ id: 'created', status: 'abierta' }])
  await saveNeed(client, 'real-owner', { ...serviceNeed, owner_id: 'intruder', status: 'cerrada', quantity: 15, unit: 'piezas' })
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(calls[0].body.owner_id, 'real-owner')
  assert.equal(calls[0].body.status, undefined)
  assert.equal(calls[0].body.quantity, null)
  assert.equal(calls[0].body.unit, null)
})

test('SDK: edición y cierre usan autor, estado abierto y versión leída', async () => {
  const previous = { id: 'need-id', updated_at: '2026-10-19T10:00:00.123456+00:00' }
  const { client, calls } = stubClient([{ id: previous.id }])
  await saveNeed(client, 'owner', goodsNeed, previous)
  await closeNeed(client, 'owner', previous)
  for (const call of calls) {
    assert.equal(call.options.method, 'PATCH')
    assert.equal(call.url.searchParams.get('owner_id'), 'eq.owner')
    assert.equal(call.url.searchParams.get('status'), 'eq.abierta')
    assert.equal(call.url.searchParams.get('updated_at'), `eq.${previous.updated_at}`)
    assert.equal(call.url.searchParams.get('id'), 'eq.need-id')
  }
  assert.deepEqual(calls[1].body, { status: 'cerrada' })
  const empty = stubClient()
  await assert.rejects(closeNeed(empty.client, 'owner', previous), error => /cambió/.test(error.userMessage))
  await assert.rejects(saveNeed(empty.client, 'owner', goodsNeed, previous), error => /cambió/.test(error.userMessage))
})

test('SDK: filtros, paginación y texto literal se conservan', async () => {
  const { client, calls } = stubClient()
  await listNeeds(client, { text: 'cajas.*",id.not.is.null', nature: 'bien', sector: 'empaque', page: 2 })
  const params = calls[0].url.searchParams
  assert.equal(params.get('status'), 'eq.abierta')
  assert.equal(params.get('nature'), 'eq.bien')
  assert.equal(params.get('sector_id'), 'eq.empaque')
  assert.equal(params.get('offset'), '12')
  assert.equal(params.get('limit'), '12')
  assert.ok(params.get('or').includes(String.raw`cajas\\.\\*\"`))
  await listNeeds(client, { ownerId: 'owner', status: 'cerrada' })
  assert.equal(calls[1].url.searchParams.get('owner_id'), 'eq.owner')
  assert.equal(calls[1].url.searchParams.get('status'), 'eq.cerrada')
})

test('SDK: clasificación se lee, crea y actualiza con control de versión', async () => {
  const record = { profile_id: 'owner', nature: 'bien', sector_id: 'empaque', updated_at: '2026-10-19T10:00:00+00:00' }
  const { client, calls } = stubClient([record])
  await getClassification(client, 'owner')
  await saveClassification(client, 'owner', record, null)
  await saveClassification(client, 'owner', { ...record, nature: 'ambos' }, record)
  assert.equal(calls[1].options.method, 'POST')
  assert.deepEqual(calls[1].body, { profile_id: 'owner', nature: 'bien', sector_id: 'empaque' })
  assert.equal(calls[2].options.method, 'PATCH')
  assert.equal(calls[2].url.searchParams.get('updated_at'), `eq.${record.updated_at}`)
  const conflict = stubClient({ code: '23505', message: 'duplicate' }, 409)
  await assert.rejects(saveClassification(conflict.client, 'owner', record, null), error => /otra ventana/.test(error.userMessage))
})
