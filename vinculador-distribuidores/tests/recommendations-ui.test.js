import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'
import { createSSRApp, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { renderToString } from 'vue/server-renderer'

test('Recomendaciones: estado del feed y componentes Vue reales', async t => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, ssr: { noExternal: ['vuetify'] } })
  try {
    const { createPinia, setActivePinia } = await server.ssrLoadModule('pinia')
    const { createVuetify } = await server.ssrLoadModule('vuetify')
    const { useAuthStore } = await server.ssrLoadModule('/src/stores/auth.js')
    const { useRecommendationsStore } = await server.ssrLoadModule('/src/stores/recommendations.js')
    const { supabase } = await server.ssrLoadModule('/src/lib/supabase.js')
    const Feed = (await server.ssrLoadModule('/src/components/recommendedFeed.vue')).default
    const Filters = (await server.ssrLoadModule('/src/components/RecommendationFilters.vue')).default
    const Card = (await server.ssrLoadModule('/src/components/PostCard.vue')).default
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }, { path: '/usuario/:id', component: { render: () => null } }] })
    await router.push('/')
    await router.isReady()
    const setup = async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const auth = useAuthStore()
      auth.user = { id: 'viewer' }
      auth.profile = { role: 'cliente' }
      const store = useRecommendationsStore()
      await nextTick()
      return { pinia, auth, store }
    }
    const render = async (component, props, pinia) => {
      const app = createSSRApp({ render: () => h(component, props) })
      app.use(pinia).use(router).use(createVuetify())
      return renderToString(app)
    }
    let handler
    const calls = []
    supabase.rpc = (_name, args) => {
      const call = { args }
      calls.push(call)
      return { select: () => ({ abortSignal: signal => { call.signal = signal; return handler(args) } }) }
    }

    await t.test('Cambiar filtros aborta la petición y descarta sus resultados tardíos', async () => {
      const { store } = await setup()
      let finishOld
      handler = () => new Promise(resolve => { finishOld = resolve })
      const old = store.init()
      const oldCall = calls.at(-1)
      store.setFilters({ nature: 'servicio', sectorId: 'tecnologia' })
      assert.equal(oldCall.signal.aborted, true)
      handler = async () => ({ data: [{ id: 'new' }], error: null })
      await store.init()
      finishOld({ data: [{ id: 'old' }], error: null })
      await old
      assert.deepEqual(store.items.map(item => item.id), ['new'])
      assert.equal(calls.at(-1).args.p_nature, 'servicio')
      assert.equal(calls.at(-1).args.p_sector_id, 'tecnologia')
      assert.deepEqual(calls.at(-1).args.p_roles, ['proveedor', 'socio'])
    })
    await t.test('La carga de siguientes tarjetas conserva filtros y exclusiones', async () => {
      const { store } = await setup()
      store.setFilters({ nature: 'bien', sectorId: 'empaque' })
      handler = async () => ({ data: Array.from({ length: 9 }, (_, i) => ({ id: `post-${i}` })), error: null })
      await store.init()
      store.activeIndex = 7
      handler = async () => ({ data: [{ id: 'post-9' }], error: null })
      await store.advance(1)
      assert.equal(calls.at(-1).args.p_nature, 'bien')
      assert.equal(calls.at(-1).args.p_sector_id, 'empaque')
      assert.equal(calls.at(-1).args.p_exclude.length, 9)
      assert.equal(store.items.length, 9)
      assert.equal(store.items.at(-1).id, 'post-9')
    })
    await t.test('Una respuesta pendiente durante el scroll no sobrevive a un cambio de filtro', async () => {
      const { store } = await setup()
      handler = async () => ({ data: Array.from({ length: 9 }, (_, i) => ({ id: `p-${i}` })), error: null })
      await store.init()
      store.activeIndex = 7
      handler = async () => ({ data: [{ id: 'stale' }], error: null })
      let release
      const waiting = new Promise(resolve => { release = resolve })
      let entered
      const ready = new Promise(resolve => { entered = resolve })
      const shift = store.advance(1, () => { entered(); return waiting })
      await ready
      store.setFilters({ nature: 'servicio' })
      release()
      await shift
      assert.deepEqual(store.items, [])
    })
    await t.test('Sin resultados muestra mensaje y botón para limpiar filtros', async () => {
      const { store, pinia } = await setup()
      store.setFilters({ nature: 'servicio', sectorId: 'empaque' })
      handler = async () => ({ data: [], error: null })
      await store.init()
      const html = await render(Feed, {}, pinia)
      assert.match(html, /No hay publicaciones recomendadas que coincidan/)
      assert.match(html, /Limpiar filtros/)
      assert.doesNotMatch(html, /No hay más recomendaciones por ahora/)
      store.setFilters()
      assert.equal(store.hasFilters, false)
      assert.equal(store.initialized, false)
      assert.equal(store.noMore, false)
    })
    await t.test('Error de activación se distingue de ausencia de resultados', async () => {
      const { store, pinia } = await setup()
      store.setFilters({ nature: 'bien' })
      handler = async () => ({ data: null, error: { code: 'PGRST202' } })
      await store.init()
      const html = await render(Feed, {}, pinia)
      assert.match(html, /todavía no están habilitados/)
      assert.match(html, /Reintentar/)
      assert.doesNotMatch(html, /No hay publicaciones recomendadas que coincidan/)
    })
    await t.test('Cambiar rol reinicia resultados; cambiar cuenta limpia los filtros', async () => {
      const { store, auth } = await setup()
      store.setFilters({ nature: 'bien', sectorId: 'empaque' })
      auth.swapView = true
      await nextTick()
      assert.equal(store.nature, 'bien')
      assert.equal(store.initialized, false)
      auth.user = { id: 'other' }
      await nextTick()
      assert.equal(store.hasFilters, false)
    })
    await t.test('Filtros visibles y explicación integrada en PostCard', async () => {
      const { pinia } = await setup()
      const filters = await render(Filters, {}, pinia)
      assert.match(filters, /Naturaleza de la oferta/)
      assert.match(filters, /Rubro de la empresa/)
      const html = await render(Card, { post: { id: 'post', author_id: 'provider', title: 'Software', profiles: { full_name: 'Empresa', role: 'proveedor' }, recommendation: { matched_nature: true, requested_nature: 'servicio', matched_sector: true, sector_name: 'Tecnología y software' }, post_tags: [] } }, pinia)
      assert.match(html, /Por qué aparece/)
      assert.match(html, /La empresa ofrece servicios/)
      assert.match(html, /Su rubro es Tecnología y software/)
    })
  } finally {
    await server.close()
  }
})
