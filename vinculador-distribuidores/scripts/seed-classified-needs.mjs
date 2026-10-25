// Optional: run only against a development project after applying the migration.
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'
import { needPayload } from '../src/lib/needs.js'
import { classifiedExamples } from '../tests/fixtures/classified-needs.js'

if (process.env.ALLOW_TEST_DATA !== 'yes') {throw new Error('Para crear datos de prueba, configura ALLOW_TEST_DATA=yes en esta terminal.')}
const env = loadEnv('development', process.cwd(), 'VITE_')
const email = process.env.SEARCH_TEST_EMAIL
const password = process.env.SEARCH_TEST_PASSWORD
if (!email || !password) {throw new Error('Configura SEARCH_TEST_EMAIL y SEARCH_TEST_PASSWORD con una cuenta de pruebas.')}
const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const { data, error } = await client.auth.signInWithPassword({ email, password })
if (error) {throw error}
try {
  for (const example of classifiedExamples) {
    const title = `[PRUEBA] ${example.title}`
    const existing = await client.from('needs').select('id').eq('owner_id', data.user.id).eq('title', title).limit(1)
    if (existing.error) {throw existing.error}
    if (existing.data.length > 0) {
      console.log(`Ya existe: ${title}`)
      continue
    }
    const created = await client.from('needs').insert({ ...needPayload({ ...example, title }), owner_id: data.user.id }).select('id').single()
    if (created.error) {throw created.error}
    console.log(`Creada necesidad de prueba: ${created.data.id}`)
  }
} finally {
  await client.auth.signOut({ scope: 'local' })
}
