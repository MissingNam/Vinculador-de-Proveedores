<template>
  <v-container max-width="700">
    <h1 class="text-h5 mb-3">{{ hasFilters ? 'Resultados de búsqueda' : 'Publicaciones' }}</h1>

    <div v-if="hasFilters" class="d-flex flex-wrap align-center ga-2 mb-4">
      <v-chip v-if="text" :aria-label="`Texto buscado: ${text}`" closable @click:close="removeFilter('q')">
        Texto: {{ text }}
      </v-chip>

      <v-chip v-if="tag" :aria-label="`Etiqueta seleccionada: ${tag}`" closable @click:close="removeFilter('tag')">
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
      <p class="text-medium-emphasis mb-4" role="status">
        {{ total }} {{ total === 1 ? 'publicación encontrada' : 'publicaciones encontradas' }}
      </p>

      <v-alert v-if="posts.length === 0" type="info" variant="tonal">
        {{ hasFilters ? 'No se encontraron publicaciones. Prueba otro texto o quita los filtros.' : 'Todavía no hay publicaciones.' }}
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
  </v-container>
</template>

<script setup>
  import { computed, onBeforeUnmount, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import PostCard from '@/components/PostCard.vue'
  import { POSTS_PAGE_SIZE, searchParam, searchPosts } from '@/lib/postSearch'
  import { supabase } from '@/lib/supabase'

  const route = useRoute()
  const router = useRouter()
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
    const request = new AbortController()
    activeRequest = request
    loading.value = true
    error.value = ''
    posts.value = []
    total.value = 0
    try {
      const result = await searchPosts(supabase, {
        text: text.value, tag: tag.value, page: page.value, signal: request.signal,
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

  watch([text, tag, page], loadPosts, { immediate: true })
  onBeforeUnmount(() => activeRequest?.abort())
</script>

