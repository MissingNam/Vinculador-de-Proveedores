import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
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
  const nature = ref(null)
  const sectorId = ref(null)
  const hasFilters = computed(() => Boolean(nature.value || sectorId.value))
  const requests = new Set()

  let generation = 0            // descarta respuestas anteriores a un reset
  let queue = Promise.resolve() // los relevos se procesan de uno en uno

  // Ajusta 'socio' si tu valor interno es otro. Sin rol efectivo = sin filtro.
  function roles() {
    const role = authStore.feedRole
    return role ? [role, 'socio'] : null
  }

  function reset() {
    for (const request of requests) {request.abort()}
    requests.clear()
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

  function setFilters(next = {}) {
    const nextNature = next.nature || null
    const nextSector = next.sectorId || null
    if (nature.value === nextNature && sectorId.value === nextSector) {return}
    nature.value = nextNature
    sectorId.value = nextSector
    reset()
  }

  function fetchPosts(options) {
    const request = new AbortController()
    requests.add(request)
    return fetchRecommendations(supabase, {
      ...options, roles: roles(), nature: nature.value, sectorId: sectorId.value, signal: request.signal,
    }).finally(() => requests.delete(request))
  }

  async function init() {
    if (initialized.value) {return}
    initialized.value = true
    const gen = generation
    loading.value = true
    error.value = ''
    try {
      const posts = await fetchPosts({ limit: WINDOW_SIZE })
      if (gen !== generation) {return}
      items.value = posts
      noMore.value = posts.length < WINDOW_SIZE
    } catch (error_) {
      if (gen !== generation) {return}
      error.value = error_.userMessage || 'No se pudieron cargar las recomendaciones. Intenta de nuevo.'
      initialized.value = false
    } finally {
      if (gen === generation) {loading.value = false}
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
    if (gen !== generation) {return false}
    if (direction > 0 && noMore.value) {return false}

    const room = direction > 0 ? items.value.length - 1 - activeIndex.value : activeIndex.value
    if (room >= BUFFER) {return false}

    let post
    try {
      const posts = await fetchPosts({
        limit: 1,
        excludeIds: items.value.map(p => p.id),
      })
      post = posts[0]
    } catch (error_) {
      if (gen === generation) {error.value = error_.userMessage || 'No se pudieron cargar más recomendaciones. Intenta de nuevo.'}
      return false
    }
    if (gen !== generation) {return false}

    if (!post) {
      if (direction > 0) {noMore.value = true}
      return false
    }

    await waitIdle?.() // no tocar la lista mientras el usuario está desplazándose
    if (gen !== generation) {return false}

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
    if (items.value.length > WINDOW_SIZE) {items.value.pop()}
    return true
  }

  // Nueva sesión o nuevo rol efectivo (incluye el switch): empezar de cero.
  watch(() => `${authStore.user?.id}|${authStore.feedRole}`, (_value, previous) => {
    if (previous?.split('|', 1)[0] !== String(authStore.user?.id)) {
      nature.value = null
      sectorId.value = null
    }
    reset()
  })

  return { items, activeIndex, loading, error, noMore, initialized, resets, nature, sectorId, hasFilters, setFilters, init, advance, reset }
})
