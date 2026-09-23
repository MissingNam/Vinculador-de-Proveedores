<template>
  <v-container class="fill-height" max-width="480">
    <v-card class="pa-6" width="100%">
      <v-card-title>Crear cuenta</v-card-title>
      <v-form @submit.prevent="handleRegister">
        <v-text-field v-model="fullName" label="Nombre completo" required />
        <v-text-field v-model="email" label="Correo" type="email" required />
        <v-text-field v-model="password" label="Contraseña" type="password" required />
        <v-radio-group v-model="role" label="Soy...">
          <v-radio label="Proveedor" value="proveedor" />
          <v-radio label="Cliente" value="cliente" />
        </v-radio-group>
        <v-alert v-if="error" type="error" density="compact" class="mb-4">{{ error }}</v-alert>
        <v-btn type="submit" color="primary" block :loading="loading">Registrarme</v-btn>
      </v-form>
      <v-card-actions>
        <RouterLink to="/login">¿Ya tienes cuenta? Inicia sesión</RouterLink>
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
    const fullName = ref('')
    const role = ref('cliente')
    const error = ref('')
    const loading = ref(false)
    const router = useRouter()
    const authStore = useAuthStore()

    async function handleRegister() {
    loading.value = true
    error.value = ''
    try {
        await authStore.signUp(email.value, password.value, fullName.value, role.value)
        router.push('/login')
    } catch (e) {
        error.value = e.message
    } finally {
        loading.value = false
    }
    }
</script>