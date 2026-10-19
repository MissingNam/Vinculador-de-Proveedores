import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'
import { createSSRApp, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { renderToString } from 'vue/server-renderer'
import { goodsNeed, serviceNeed } from './fixtures/classified-needs.js'

test('Los componentes se renderizan con Vuetify y los campos correspondientes', async t => {
  const server = await createServer({
    server: { middlewareMode: true, hmr: false, watch: null },
    ssr: { noExternal: ['vuetify'] },
  })
  try {
    const { createVuetify } = await server.ssrLoadModule('vuetify')
    const NeedForm = (await server.ssrLoadModule('/src/components/NeedForm.vue')).default
    const sectors = [{ id: 'empaque', name: 'Empaque y embalaje', active: true }, { id: 'tecnologia', name: 'Tecnología y software', active: true }]
    const render = async (component, props, router) => {
      const app = createSSRApp({ render: () => h(component, props) })
      app.use(createVuetify())
      if (router) {app.use(router)}
      return renderToString(app)
    }
    await t.test('Bienes muestran cantidad, unidad y entrega', async () => {
      const html = await render(NeedForm, { initial: goodsNeed, sectors })
      assert.match(html, /Cantidad/)
      assert.match(html, /Unidad/)
      assert.match(html, /Fecha deseada de entrega/)
      assert.doesNotMatch(html, /Alcance y entregables esperados/)
      assert.match(html, /Empaque y embalaje/)
      assert.match(html, /Guardar cambios/)
    })
    await t.test('Servicios muestran modalidad, alcance y fechas', async () => {
      const html = await render(NeedForm, { initial: serviceNeed, sectors })
      assert.match(html, /Modalidad/)
      assert.match(html, /Alcance y entregables esperados/)
      assert.match(html, /Inicio deseado/)
      assert.doesNotMatch(html, /Fecha deseada de entrega/)
      assert.doesNotMatch(html, />Cantidad</)
    })
    await t.test('Perfil conserva rol y enlace a su detalle', async () => {
      const router = createRouter({ history: createMemoryHistory(), routes: [
        { path: '/perfiles', component: { render: () => null } },
        { path: '/usuario/:id', name: 'user-profile', component: { render: () => null } },
      ] })
      await router.push('/perfiles')
      await router.isReady()
      const ProfileCard = (await server.ssrLoadModule('/src/components/ProfileCard.vue')).default
      const html = await render(ProfileCard, { profile: { id: 'demo', role: 'socio', full_name: 'Socio de prueba' } }, router)
      assert.match(html, /Socio de prueba/)
      assert.match(html, /Socio/)
      assert.match(html, /href="\/usuario\/demo"/)
    })
  } finally {
    await server.close()
  }
})
