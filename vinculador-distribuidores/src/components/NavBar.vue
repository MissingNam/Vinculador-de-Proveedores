<template>
  <v-app-bar>
    <v-app-bar-title>
      <RouterLink to="/" class="text-decoration-none text-white">
        Sun Finder
      </RouterLink>
    </v-app-bar-title>
    <v-text-field
      density="compact"
      variant="solo"
      hide-details
      prepend-inner-icon="mdi-magnify"
      placeholder="Buscar..."
      style="max-width: 320px"
      class="mx-4"
    />
    <v-spacer />
    <v-btn to="/publicar" icon="mdi-plus" />
    <v-btn to="/perfil" icon="mdi-account" />
    <v-btn icon="mdi-logout" @click="logout" />
  </v-app-bar>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

async function logout() {
  await authStore.signOut()
  router.push('/login')
}
</script>