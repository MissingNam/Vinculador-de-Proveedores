<template>
  <v-container max-width="800">
    <v-btn class="mb-4" prepend-icon="mdi-arrow-left" to="/necesidades" variant="text">Necesidades</v-btn>
    <v-progress-linear v-if="loading" aria-label="Cargando necesidad" indeterminate />
    <v-alert v-else-if="error" type="error" variant="tonal">{{ error }} <v-btn variant="text" @click="load">Reintentar</v-btn></v-alert>
    <v-alert v-else-if="!need" type="info" variant="tonal">La necesidad no está disponible. Puede estar cerrada o no existir.</v-alert>

    <v-card v-else class="pa-4 pa-md-6">
      <div class="d-flex flex-wrap ga-2 mb-4">
        <v-chip color="primary" variant="tonal">{{ natureLabel(need.nature) }}</v-chip>
        <v-chip color="secondary" variant="tonal">{{ need.sectors?.name }}</v-chip>
        <v-chip :color="need.status === 'abierta' ? 'success' : 'muted'" variant="tonal">{{ need.status === 'abierta' ? 'Abierta' : 'Cerrada' }}</v-chip>
      </div>

      <h1 class="page-title text-break">{{ need.title }}</h1>
      <p class="text-muted mb-4">Publicada por <RouterLink :to="{ name: 'user-profile', params: { id: need.owner_id } }">{{ need.profiles?.full_name || 'Usuario' }}</RouterLink></p>
      <p class="multiline mb-4">{{ need.description }}</p>
      <h2 class="text-body-2 text-muted font-weight-medium">Ubicación</h2>
      <p class="mb-4">{{ need.city }}, {{ need.region }}, {{ need.country }}</p>
      <h2 class="text-body-2 text-muted font-weight-medium">Presupuesto total estimado</h2>
      <p class="mb-4">{{ money(need.budget_min) }} – {{ money(need.budget_max) }}</p>

      <template v-if="need.nature === 'bien'">
        <h2 class="text-body-2 text-muted font-weight-medium">Cantidad solicitada</h2>
        <p class="mb-4">{{ need.quantity }} {{ need.unit }}</p>
        <p v-if="need.delivery_date">Entrega deseada: {{ displayDate(need.delivery_date) }}</p>
      </template>

      <template v-else>
        <h2 class="text-body-2 text-muted font-weight-medium">Modalidad</h2>
        <p class="mb-4">{{ SERVICE_MODES.find(item => item.value === need.service_mode)?.title }}</p>
        <h2 class="text-body-2 text-muted font-weight-medium">Alcance y entregables</h2>
        <p class="multiline mb-4">{{ need.service_scope }}</p>
        <p v-if="need.start_date">Inicio deseado: {{ displayDate(need.start_date) }}</p>
        <p v-if="need.end_date">Fin deseado: {{ displayDate(need.end_date) }}</p>
      </template>

      <v-alert v-if="need.status === 'cerrada'" class="mt-4" type="info" variant="tonal">Esta necesidad está cerrada y se conserva para consulta.</v-alert>

      <div v-if="isOwner && need.status === 'abierta'" class="d-flex flex-wrap ga-2 mt-6">
        <v-btn color="primary" :to="{ name: 'need-edit', params: { id: need.id } }">Editar necesidad</v-btn>
        <v-btn color="warning" variant="outlined" @click="confirmClose = true">Cerrar necesidad</v-btn>
      </div>
    </v-card>

    <v-dialog v-model="confirmClose" max-width="480" :persistent="closing">
      <v-card title="Cerrar necesidad">
        <v-card-text>
          Se retirará del listado de necesidades abiertas y quedará en tus necesidades cerradas. Ya no podrás editarla ni reabrirla.
          <v-alert
            v-if="closeError"
            class="mt-4"
            role="alert"
            type="error"
            variant="tonal"
          >{{ closeError }}</v-alert>
        </v-card-text>

        <v-card-actions>
          <v-btn :disabled="closing" @click="confirmClose = false">Cancelar</v-btn>
          <v-btn color="warning" :loading="closing" @click="close">Cerrar necesidad</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
  import { computed, onBeforeUnmount, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { featureError, natureLabel, SERVICE_MODES } from '@/lib/classification'
  import { closeNeed, getNeed } from '@/lib/needs'
  import { supabase } from '@/lib/supabase'
  import { useAuthStore } from '@/stores/auth'
  const route = useRoute()
  const auth = useAuthStore()
  const need = ref(null)
  const loading = ref(true)
  const error = ref('')
  const confirmClose = ref(false)
  const closing = ref(false)
  const closeError = ref('')
  const isOwner = computed(() => need.value?.owner_id === auth.user?.id)
  let generation = 0
  const money = amount => new Intl.NumberFormat('es-MX', { style: 'currency', currency: need.value.currency, currencyDisplay: 'code' }).format(amount)
  const displayDate = value => value.split('-').toReversed().join('/')

  async function load() {
    const current = ++generation
    loading.value = true
    error.value = ''
    confirmClose.value = false
    closeError.value = ''
    try {
      const data = await getNeed(supabase, route.params.id)
      if (current === generation) need.value = data
    } catch (error_) {
      if (current === generation) error.value = featureError(error_, 'No se pudo cargar la necesidad.')
    } finally {
      if (current === generation) loading.value = false
    }
  }
  async function close() {
    if (closing.value || !isOwner.value) return
    closing.value = true
    closeError.value = ''
    try {
      await closeNeed(supabase, auth.user.id, need.value)
      await load()
    } catch (error_) {
      closeError.value = featureError(error_, 'No se pudo cerrar la necesidad. Intenta de nuevo.')
    } finally {
      closing.value = false
    }
  }
  watch(() => route.params.id, load, { immediate: true })
  onBeforeUnmount(() => generation++)
</script>

<style scoped>
.multiline { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>