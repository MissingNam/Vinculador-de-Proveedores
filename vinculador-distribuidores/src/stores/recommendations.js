import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { BUFFER, fetchRecommendations, WINDOW_SIZE } from '@/lib/recommendations'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

export const useRecommendationsStore = defineStore('recommendations', () => {
  const authStore = useAuthStore()

  const items = ref([])         // la ventana (máx. 9 posts)
  const activeIndex = ref(0)    // posición del post que se está viendo
  const loading = ref(false)
  const error = ref('')
  const noMore = ref(false)     // la base de datos ya no devolvió nada
  const initialized = ref(false)
  const resets = ref(0)         // el componente lo observa para recargar

  let generation = 0            // descarta respuestas anteriores a un reset
  let queue = Promise.resolve() // los relevos se procesan de uno en uno

  // Ajusta 'socio' si tu valor interno es otro. Sin rol efectivo = sin filtro.
  function roles() {
    const role = authStore.feedRole
    return role ? [role, 'socio'] : null
  }

  function reset() {
    generation++
    resets.value++
    items.value = []
    activeIndex.value = 0
    loading.value = false
    error.value = ''
    noMore.value = false
    initialized.value = false
    queue = Promise.resolve()
  }

  async function init() {
    if (initialized.value) return
    initialized.value = true
    const gen = generation
    loading.value = true
    error.value = ''
    try {
      const posts = await fetchRecommendations(supabase, { limit: WINDOW_SIZE, roles: roles() })
      if (gen !== generation) return
      items.value = posts
      noMore.value = posts.length < WINDOW_SIZE
    } catch {
      if (gen !== generation) return
      error.value = 'No se pudieron cargar las recomendaciones. Intenta de nuevo.'
      initialized.value = false
    } finally {
      if (gen === generation) loading.value = false
    }
  }

  // direction: 1 = el usuario bajó, -1 = subió.
  // Devuelve cuántos slides cambiaron ARRIBA del actual (para compensar el scroll):
  //   -1 = se quitó el primero, +1 = se añadió uno al inicio, 0 = nada arriba.
  function advance(direction, waitIdle) {
    const gen = generation
    const task = queue.then(() => shift(direction, gen, waitIdle))
    queue = task.catch(() => {})
    return task
  }

  async function shift(direction, gen, waitIdle) {
    if (gen !== generation) return false

    const room = direction > 0 ? items.value.length - 1 - activeIndex.value : activeIndex.value
    if (room >= BUFFER) return false

    let post
    try {
      const posts = await fetchRecommendations(supabase, {
        limit: 1,
        excludeIds: items.value.map(p => p.id),
        roles: roles(),
      })
      post = posts[0]
    } catch {
      return false
    }
    if (gen !== generation) return false

    if (!post) {
      if (direction > 0) noMore.value = true
      return false
    }

    await waitIdle?.() // no tocar la lista mientras el usuario está desplazándose
    if (gen !== generation) return false

    if (direction > 0) {
      noMore.value = false
      items.value.push(post)
      if (items.value.length > WINDOW_SIZE) {
        items.value.shift()
        activeIndex.value--
      }
      return true
    }

    items.value.unshift(post)
    activeIndex.value++
    if (items.value.length > WINDOW_SIZE) items.value.pop()
    return true
  }

  // Nueva sesión o nuevo rol efectivo (incluye el switch): empezar de cero.
  watch(() => `${authStore.user?.id}|${authStore.feedRole}`, reset)

  return { items, activeIndex, loading, error, noMore, initialized, resets, init, advance, reset }
})