import assert from 'node:assert/strict'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'
import { searchPosts } from '../src/lib/postSearch.js'
import { searchProfiles } from '../src/lib/profileSearch.js'

// Read-only integration checks against a small development dataset.
test('Búsquedas de perfiles y publicaciones en Supabase', async t => {
  const env = loadEnv('development', process.cwd(), 'VITE_')
  const email = process.env.SEARCH_TEST_EMAIL
  const password = process.env.SEARCH_TEST_PASSWORD
  assert.ok(email && password, 'Configura SEARCH_TEST_EMAIL y SEARCH_TEST_PASSWORD con una cuenta de pruebas.')
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const login = await client.auth.signInWithPassword({ email, password })
  assert.ifError(login.error)

  try {
    const profileResult = await searchProfiles(client, { pageSize: 100 })
    const postResult = await searchPosts(client, { pageSize: 100 })
    assert.ok(profileResult.total > 0, 'Se necesitan perfiles de prueba.')
    assert.ok(postResult.total > 0, 'Se necesitan publicaciones para comprobar regresiones.')
    assert.equal(profileResult.profiles.length, profileResult.total, 'Usa un conjunto de prueba de hasta 100 perfiles.')
    assert.equal(postResult.posts.length, postResult.total, 'Usa un conjunto de prueba de hasta 100 publicaciones.')

    const profiles = profileResult.profiles
    const posts = postResult.posts
    const names = profiles.map(profile => profile.full_name).filter(Boolean)
    const tagsOf = (item, relation) => (item[relation] ?? []).map(row => row.tags).filter(Boolean)
    const profileTags = [...new Set(profiles.flatMap(profile => tagsOf(profile, 'profile_tags').map(tag => tag.name)))]
    const postTags = [...new Set(posts.flatMap(post => tagsOf(post, 'post_tags').map(tag => tag.name)))]

    async function checkProfiles(options) {
      const text = (options.text ?? '').trim().toLowerCase()
      const tag = (options.tag ?? '').trim()
      const expected = profiles.filter(profile => {
        const tags = tagsOf(profile, 'profile_tags')
        return (!tag || tags.some(item => item.name === tag))
          && (!text || [profile.full_name, ...tags.map(item => item.name)].some(value => value?.toLowerCase().includes(text)))
      })
      const actual = await searchProfiles(client, { ...options, pageSize: 100 })
      assert.deepEqual(actual.profiles.map(profile => profile.id), expected.map(profile => profile.id))
      assert.equal(actual.total, expected.length)
      for (const profile of actual.profiles) {
        const original = profiles.find(item => item.id === profile.id)
        assert.deepEqual(tagsOf(profile, 'profile_tags').map(tag => tag.id).toSorted(), tagsOf(original, 'profile_tags').map(tag => tag.id).toSorted())
      }
    }

    await t.test('Nombre completo, parcial, mayúsculas y espacios', async () => {
      for (const name of names) {
        await checkProfiles({ text: name })
        await checkProfiles({ text: `  ${name.slice(0, 4).toUpperCase()}  ` })
      }
    })
    await t.test('Etiquetas del perfil y combinación con nombre', async () => {
      assert.ok(profileTags.length > 0, 'Se necesita al menos un perfil con etiquetas.')
      for (const tag of profileTags) {
        await checkProfiles({ text: tag.toUpperCase() })
        await checkProfiles({ tag })
        for (const name of names) {await checkProfiles({ text: name, tag })}
      }
    })
    await t.test('Perfiles sin etiquetas y sin publicaciones', async () => {
      const withoutTags = profiles.filter(profile => tagsOf(profile, 'profile_tags').length === 0)
      const withoutPosts = profiles.filter(profile => !posts.some(post => post.author_id === profile.id))
      assert.ok(withoutTags.length > 0 && withoutPosts.length > 0, 'Incluye perfiles sin etiquetas y sin publicaciones en los datos de prueba.')
      for (const profile of [...withoutTags, ...withoutPosts]) {await checkProfiles({ text: profile.full_name })}
    })
    await t.test('Las etiquetas de posts no se atribuyen a sus autores', async () => {
      for (const tag of postTags) {
        await checkProfiles({ tag })
        await checkProfiles({ text: tag })
      }
    })
    await t.test('Sin resultados, puntuación literal y filtros vacíos', async () => {
      for (const text of ['', ' '.repeat(3), 'zz-no-existe-98237', '*', '%', '_', '.', '[', '(', '\\', '"', '",id.not.is.null']) {
        await checkProfiles({ text })
      }
      await checkProfiles({ tag: 'zz-etiqueta-inexistente-98237' })
    })
    await t.test('Paginación sin perfiles duplicados ni omitidos', async () => {
      const ids = []
      for (let page = 1; page <= profiles.length; page++) {
        const result = await searchProfiles(client, { page, pageSize: 1 })
        assert.equal(result.total, profiles.length)
        assert.equal(result.profiles.length, 1)
        ids.push(result.profiles[0].id)
      }
      assert.deepEqual(ids, profiles.map(profile => profile.id))
    })
    await t.test('Se pueden cancelar las consultas', async () => {
      const controller = new AbortController()
      controller.abort()
      await assert.rejects(searchProfiles(client, { signal: controller.signal }))
      await assert.rejects(searchPosts(client, { signal: controller.signal }))
    })
    await t.test('Regresión de búsqueda por texto y etiquetas de posts', async () => {
      const terms = ['', 'Hola', '  MAQUINARIA  ', '*', '%', '",id.not.is.null']
      for (const text of terms) {
        for (const tag of ['', ...postTags]) {
          const expected = posts.filter(post => {
            const tags = tagsOf(post, 'post_tags')
            return (!tag || tags.some(item => item.name === tag))
              && (!text.trim() || [post.title, post.description, ...tags.map(item => item.name)].some(value => value?.toLowerCase().includes(text.trim().toLowerCase())))
          })
          const actual = await searchPosts(client, { text, tag, pageSize: 100 })
          assert.deepEqual(actual.posts.map(post => post.id), expected.map(post => post.id))
          assert.equal(actual.total, expected.length)
        }
      }
    })
  } finally {
    await client.auth.signOut({ scope: 'local' })
  }
})
