<template>
  <v-app-bar extension-height="64">
    <v-app-bar-title>
      <RouterLink class="text-decoration-none text-white" to="/">Sun Finder</RouterLink>
    </v-app-bar-title>

    <v-spacer />
    <v-btn aria-label="Crear publicación" icon="mdi-plus" to="/publicar" />
    <v-btn aria-label="Mi perfil" icon="mdi-account" to="/perfil" />
    <v-btn aria-label="Cerrar sesión" icon="mdi-logout" @click="logout" />

    <template #extension>
      <div class="search-controls">
        <v-select
          v-model="searchType"
          aria-label="Buscar en"
          class="search-type"
          density="compact"
          hide-details
          :items="searchTypes"
          label="Buscar en"
          variant="solo"
          @update:model-value="changeSearchType"
        />

        <v-text-field
          v-model="searchText"
          :aria-label="searchType === 'profiles' ? 'Buscar perfiles' : 'Buscar publicaciones'"
          class="search-field"
          clearable
          density="compact"
          hide-details
          :placeholder="searchType === 'profiles' ? 'Nombre o etiqueta…' : 'Buscar publicaciones…'"
          variant="solo"
          @click:clear="clearSearch"
          @keydown.enter.prevent="search"
        >
          <template #prepend-inner>
            <v-btn
              aria-label="Buscar"
              icon="mdi-magnify"
              size="small"
              variant="text"
              @click="search"
            />
          </template>
        </v-text-field>
      </div>
    </template>
  </v-app-bar>
</template>

<script setup>
  import { ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { searchParam } from '@/lib/searchUtils'
  import { useAuthStore } from '@/stores/auth'

  const router = useRouter()
  const route = useRoute()
  const authStore = useAuthStore()
  const searchText = ref('')
  const searchType = ref('posts')
  const searchTypes = [
    { title: 'Publicaciones', value: 'posts' },
    { title: 'Perfiles', value: 'profiles' },
  ]

  watch(() => route.query.q, value => {
    searchText.value = searchParam(value)
  }, { immediate: true })

  watch(() => route.path, path => {
    searchType.value = path === '/perfiles' || path === '/perfil' || path.startsWith('/usuario/') ? 'profiles' : 'posts'
  }, { immediate: true })

  function search() {
    const q = searchParam(searchText.value)
    searchText.value = q
    const path = searchType.value === 'profiles' ? '/perfiles' : '/'
    const sameSearch = path === '/perfiles' ? route.path === '/perfiles' : ['/', '/feed'].includes(route.path)
    const tag = sameSearch ? searchParam(route.query.tag) : ''
    router.push({ path, query: { ...(q ? { q } : {}), ...(tag ? { tag } : {}) } })
  }

  function changeSearchType() {
    // Switching category preserves the text, but not a tag from another category.
    const q = searchParam(searchText.value)
    router.push({ path: searchType.value === 'profiles' ? '/perfiles' : '/', query: q ? { q } : {} })
  }

  function clearSearch() {
    searchText.value = ''
    search()
  }

  async function logout() {
    await authStore.signOut()
    router.push('/login')
  }
</script>

<style scoped>
.search-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 0 16px;
}

.search-type {
  flex: 0 0 160px;
}

.search-field {
  flex: 1 1 0;
  min-width: 0;
}

@media (max-width: 400px) {
  .search-controls {
    gap: 8px;
    padding: 0 8px;
  }

  .search-type {
    flex-basis: 140px;
  }
}
</style>