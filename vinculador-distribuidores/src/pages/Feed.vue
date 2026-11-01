<template>
  <div class="discover" :class="{ 'discover--fill': !hasFilters }">
    <header class="discover-inner discover-header">
      <h1 class="page-title">Descubre oportunidades</h1>
      <p class="discover-subtitle text-muted">Encuentra empresas con las que puedes hacer negocios</p>

      <div class="discover-controls">
        <div v-if="canChooseRole" class="explore">
          <span id="explore-label" class="explore-label">Explorar</span>
          <v-btn-toggle
            v-model="explore"
            aria-labelledby="explore-label"
            color="primary"
            density="comfortable"
            divided
            mandatory
            role="group"
            variant="outlined"
          >
            <v-btn
              v-for="option in exploreOptions"
              :key="option.value"
              :prepend-icon="explore === option.value ? 'mdi-check' : undefined"
              :value="option.value"
            >
              {{ option.label }}
            </v-btn>
          </v-btn-toggle>
        </div>

        <SearchBox class="discover-search" path="/" placeholder="Buscar ofertas o necesidades" />
      </div>
    </header>

    <!-- Una recomendación a la vez -->
    <RecommendedFeed v-if="!hasFilters" />

    <!-- Búsqueda manual: lista paginada -->
    <section v-else aria-label="Resultados de búsqueda" class="discover-inner discover-results">
      <h2 class="text-h6 mb-4">Resultados de búsqueda</h2>

      <div class="d-flex flex-wrap align-center ga-2 mb-4">
        <v-chip
          v-if="text"
          :aria-label="`Texto buscado: ${text}`"
          closable
          color="primary"
          variant="tonal"
          @click:close="removeFilter('q')"
        >
          Texto: {{ text }}
        </v-chip>

        <v-chip
          v-if="tag"
          :aria-label="`Etiqueta seleccionada: ${tag}`"
          closable
          color="primary"
          variant="tonal"
          @click:close="removeFilter('tag')"
        >
          Etiqueta: {{ tag }}
        </v-chip>

        <v-btn :to="{ path: '/', query: {} }" variant="text">Limpiar filtros</v-btn>
      </div>

      <div v-if="loading" class="text-center py-6" role="status">
        <v-progress-circular aria-label="Cargando publicaciones" indeterminate />
        <p class="mt-2">Buscando publicaciones…</p>
      </div>

      <v-alert v-else-if="error" class="mb-4" type="error">
        {{ error }}
        <v-btn variant="text" @click="loadPosts">Reintentar</v-btn>
      </v-alert>

      <template v-else>
        <p class="text-muted mb-4" role="status">
          {{ total }} {{ total === 1 ? 'publicación encontrada' : 'publicaciones encontradas' }}
        </p>

        <v-alert v-if="posts.length === 0" type="info" variant="tonal">
          No se encontraron publicaciones. Prueba otro texto o quita los filtros.
        </v-alert>

        <PostCard v-for="post in posts" :key="post.id" :post="post" @deleted="loadPosts" />

        <v-pagination
          v-if="pageCount > 1"
          aria-label="Páginas de publicaciones"
          :length="pageCount"
          :model-value="page"
          :total-visible="5"
          @update:model-value="changePage"
        />
      </template>
    </section>
  </div>
</template>

<script setup>
  import { computed, onBeforeUnmount, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import PostCard from '@/components/PostCard.vue'
  import RecommendedFeed from '@/components/RecommendedFeed.vue'
  import SearchBox from '@/components/SearchBox.vue'
  import { POSTS_PAGE_SIZE, searchParam, searchPosts } from '@/lib/postSearch'
  import { supabase } from '@/lib/supabase'
  import { useAuthStore } from '@/stores/auth'

  const authStore = useAuthStore()
  const route = useRoute()
  const router = useRouter()

  // --- Selector "Explorar" (reemplaza al interruptor) ---
  const exploreOptions = [
    { value: 'proveedor', label: 'Proveedores' },
    { value: 'cliente', label: 'Clientes' },
  ]
  const myRole = computed(() => authStore.profile?.role)
  const canChooseRole = computed(() => ['cliente', 'proveedor'].includes(myRole.value)) // el socio ve todo
  const explore = computed({
    get: () => authStore.feedRole,
    // Explorar mi mismo rol = vista invertida; explorar el opuesto = vista normal
    set: value => {
      if (value) authStore.swapView = value === myRole.value
    },
  })
  const targetRole = computed(() => authStore.feedRole)

  // --- Búsqueda manual ---
  const posts = ref([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref('')
  const text = computed(() => searchParam(route.query.q))
  const tag = computed(() => searchParam(route.query.tag))
  const hasFilters = computed(() => Boolean(text.value || tag.value))
  const page = computed(() => {
    const value = Number(searchParam(route.query.page))
    return Number.isSafeInteger(value) && value > 0 && value <= 1_000_000 ? value : 1
  })
  const pageCount = computed(() => Math.ceil(total.value / POSTS_PAGE_SIZE))
  let activeRequest

  async function loadPosts() {
    activeRequest?.abort()
    if (!hasFilters.value) {
      posts.value = []
      total.value = 0
      loading.value = false
      return
    }
    const request = new AbortController()
    activeRequest = request
    loading.value = true
    error.value = ''
    posts.value = []
    total.value = 0
    try {
      const result = await searchPosts(supabase, {
        text: text.value, tag: tag.value, role: targetRole.value,
        page: page.value, signal: request.signal,
      })
      if (request.signal.aborted) return
      posts.value = result.posts
      total.value = result.total
      const lastPage = Math.max(1, Math.ceil(result.total / POSTS_PAGE_SIZE))
      if (page.value > lastPage) {
        await router.replace({ path: route.path, query: { ...route.query, page: lastPage === 1 ? undefined : String(lastPage) } })
      }
    } catch {
      if (!request.signal.aborted) {
        error.value = 'No se pudieron cargar las publicaciones. Intenta de nuevo.'
      }
    } finally {
      if (activeRequest === request) loading.value = false
    }
  }

  function removeFilter(key) {
    const query = { ...route.query }
    delete query[key]
    delete query.page
    router.push({ path: '/', query })
  }

  function changePage(value) {
    router.push({ path: route.path, query: { ...route.query, page: value === 1 ? undefined : String(value) } })
  }

  watch([text, tag, page, targetRole], loadPosts, { immediate: true })
  onBeforeUnmount(() => activeRequest?.abort())
</script>

<style scoped>
  .discover {
    width: 100%;
  }

  /* Modo recomendación: la página ocupa exactamente la pantalla disponible,
     sin scroll de página; solo se desplaza el área de recomendaciones. */
  .discover--fill {
    display: flex;
    flex-direction: column;
    height: calc(100dvh - var(--v-layout-top, 0px) - var(--v-layout-bottom, 0px));
  }

  .discover-inner {
    width: 100%;
    max-width: 752px;          /* 720px de contenido + 16px de margen a cada lado */
    margin-inline: auto;
    padding-inline: 16px;
  }

  .discover-header {
    flex: 0 0 auto;
    padding-block: 16px 8px;
  }

  .discover-header .page-title {
    margin-bottom: 8px;
  }

  .discover-subtitle {
    margin: 0 0 16px;
  }

  .discover-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 16px;
  }

  .discover-search {
    flex: 1 1 280px;
    min-width: 0;
  }

  .explore {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .explore-label {
    font-size: 0.875rem;
    font-weight: 600;
  }

  /* El grupo se ve como un solo control con esquinas de 10px */
  .explore :deep(.v-btn-group) {
    border-radius: var(--radius-control);
    overflow: hidden;
  }

  .explore :deep(.v-btn-group .v-btn) {
    border-radius: 0;
  }

  .discover-results {
    padding-block: 16px 32px;
  }

  @media (min-width: 960px) {
    .discover-header {
      padding-block: 24px 8px;
    }
  }
</style>