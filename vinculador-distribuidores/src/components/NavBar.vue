<template>
  <v-app-bar>
    <v-app-bar-title>
      <RouterLink class="text-decoration-none text-white" to="/">
        Sun Finder
      </RouterLink>
    </v-app-bar-title>

    <v-text-field
      v-model="searchText"
      aria-label="Buscar publicaciones"
      class="mx-4"
      clearable
      density="compact"
      hide-details
      placeholder="Buscar..."
      style="max-width: 320px"
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

    <v-spacer />
    <v-btn icon="mdi-plus" to="/publicar" />
    <v-btn icon="mdi-account" to="/perfil" />
    <v-btn icon="mdi-logout" @click="logout" />
  </v-app-bar>
</template>

<script setup>
  import { ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { searchParam } from '@/lib/postSearch'
  import { useAuthStore } from '@/stores/auth'

  const router = useRouter()
  const route = useRoute()
  const authStore = useAuthStore()
  const searchText = ref('')

  watch(() => route.query.q, value => {
    searchText.value = searchParam(value)
  }, { immediate: true })

  function search() {
    const q = searchParam(searchText.value)
    searchText.value = q
    const tag = ['/', '/feed'].includes(route.path) ? searchParam(route.query.tag) : ''
    router.push({ path: '/', query: { ...(q ? { q } : {}), ...(tag ? { tag } : {}) } })
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
