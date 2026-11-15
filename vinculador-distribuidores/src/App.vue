<template>
  <v-app>
    <NavBar v-if="authStore.user && !authStore.needsProfile" />
    <v-main>
      <RouterView />
    </v-main>
  </v-app>
</template>

<!-- src/App.vue -->
<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import NavBar from '@/components/NavBar.vue'

const authStore = useAuthStore()
onMounted(() => authStore.init())
</script>
