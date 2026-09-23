<template>
  <v-container class="fill-height" max-width="480">
    <v-card class="pa-6" width="100%">
      <v-card-title>Crear cuenta</v-card-title>
      <v-form @submit.prevent="handleRegister">
        <v-text-field v-model="email" label="Correo" type="email" required />
        <v-text-field v-model="password" label="Contraseña" type="password" required />
        <v-alert v-if="error" type="error" density="compact" class="mb-4">{{ error }}</v-alert>
        <v-btn type="submit" color="primary" block :loading="loading">Iniciar Sesion</v-btn>
      </v-form>
      <v-card-actions>
        <RouterLink to="/register">¿No tienes cuenta? Registrate!!</RouterLink>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script setup>
    import { ref } from 'vue'
    import { useRouter } from 'vue-router'
    import { useAuthStore } from '@/stores/auth'

    const email = ref('')
    const password = ref('')
    const error = ref('')
    const loading = ref(false)
    const router = useRouter()
    const authStore = useAuthStore()

    async function handleRegister() {
    loading.value = true
    error.value = ''
    try {
        await authStore.signIn(email.value, password.value)
        router.push('/')
    } catch (e) {
        error.value = e.message
    } finally {
        loading.value = false
    }
    }
</script>