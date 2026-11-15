<template>
  <v-container class="fill-height" max-width="480">
    <v-card class="pa-4 pa-md-6" width="100%">
      <v-card-title>Completa tu perfil</v-card-title>
      <p class="text-muted mb-4">Un último paso para empezar a usar Sun Finder.</p>

      <div class="d-flex align-center ga-4 mb-6">
        <v-avatar color="primary" size="48" variant="tonal">
          <v-img v-if="avatarUrl" alt="" cover :src="avatarUrl" />
          <v-icon v-else icon="mdi-account" />
        </v-avatar>
        <div class="text-body-2 text-muted text-break">{{ authStore.user?.email }}</div>
      </div>

      <v-form @submit.prevent="submit">
        <v-text-field
          v-model="fullName"
          hint="Se mostrará en tu perfil y en tus publicaciones."
          label="Nombre de tu empresa"
          persistent-hint
        />

        <v-radio-group
          v-model="role"
          class="mt-4"
          hint="Por ahora no se puede cambiar después."
          label="Soy…"
          persistent-hint
        >
          <v-radio v-for="option in roleOptions" :key="option.value" :value="option.value">
            <template #label>
              <div><strong>{{ option.label }}</strong> <span class="text-muted">— {{ option.help }}</span></div>
            </template>
          </v-radio>
        </v-radio-group>

        <v-alert v-if="error" class="mt-4" density="compact" type="error">{{ error }}</v-alert>
        <v-btn block class="mt-4" :disabled="!canSubmit" :loading="loading" type="submit">Continuar</v-btn>
      </v-form>

      <v-btn block class="mt-4" variant="text" @click="useAnotherAccount">Usar otra cuenta</v-btn>
    </v-card>
  </v-container>
</template>

<script setup>
  import { computed, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { ROLE_LABELS } from '@/lib/roles'
  import { useAuthStore } from '@/stores/auth'

  const router = useRouter()
  const authStore = useAuthStore()
  const metadata = authStore.user?.user_metadata ?? {}

  const fullName = ref(metadata.full_name || metadata.name || '')
  const role = ref(null)          // sin valor por defecto: la elección debe ser consciente
  const error = ref('')
  const loading = ref(false)

  const avatarUrl = computed(() => metadata.avatar_url || metadata.picture || '')
  const roleOptions = [
    { value: 'proveedor', label: ROLE_LABELS.proveedor, help: 'ofrezco productos o servicios' },
    { value: 'cliente', label: ROLE_LABELS.cliente, help: 'busco proveedores' },
    { value: 'socio', label: ROLE_LABELS.socio, help: 'compro y ofrezco a la vez' },
  ]
  const canSubmit = computed(() => fullName.value.trim().length >= 2 && Boolean(role.value))

  async function submit() {
    if (!canSubmit.value || loading.value) return
    loading.value = true
    error.value = ''
    try {
      await authStore.completeProfile(fullName.value.trim(), role.value)
      router.replace('/')
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function useAnotherAccount() {
    await authStore.signOut()
    router.replace('/login')
  }
</script>