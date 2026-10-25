<template>
  <v-container max-width="800">
    <h1 class="text-h5 mb-4">{{ id ? 'Editar necesidad' : 'Nueva necesidad' }}</h1>
    <v-progress-linear v-if="loading" aria-label="Cargando formulario" indeterminate />

    <v-alert v-else-if="loadError" type="error" variant="tonal">
      {{ loadError }}
      <v-btn variant="text" @click="load">Reintentar</v-btn>
      <v-btn to="/necesidades" variant="text">Volver a necesidades</v-btn>
    </v-alert>

    <v-alert v-else-if="blocked" type="info" variant="tonal">
      {{ blocked }}
      <v-btn to="/necesidades" variant="text">Volver a necesidades</v-btn>
    </v-alert>

    <v-card v-else class="pa-4 pa-sm-6">
      <v-alert
        v-if="saveError"
        class="mb-4"
        role="alert"
        type="error"
        variant="tonal"
      >{{ saveError }}</v-alert>

      <NeedForm
        :key="id || 'new'"
        :busy="saving"
        :initial="previous"
        :sectors="sectors"
        @cancel="cancel"
        @save="save"
      />
    </v-card>
  </v-container>
</template>

<script setup>
  import { computed, onBeforeUnmount, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import NeedForm from '@/components/NeedForm.vue'
  import { featureError, listSectors } from '@/lib/classification'
  import { getNeed, saveNeed } from '@/lib/needs'
  import { supabase } from '@/lib/supabase'
  import { useAuthStore } from '@/stores/auth'

  const route = useRoute()
  const router = useRouter()
  const auth = useAuthStore()
  const id = computed(() => route.params.id)
  const previous = ref(null)
  const sectors = ref([])
  const loading = ref(true)
  const saving = ref(false)
  const loadError = ref('')
  const saveError = ref('')
  const blocked = ref('')
  let generation = 0
  async function load() {
    const current = ++generation
    loading.value = true
    loadError.value = ''
    blocked.value = ''
    saveError.value = ''
    try {
      const [catalog, need] = await Promise.all([listSectors(supabase), id.value ? getNeed(supabase, id.value) : null])
      if (current !== generation) return
      sectors.value = catalog
      previous.value = need
      if (id.value && (!need || need.owner_id !== auth.user?.id)) blocked.value = 'Esta necesidad no está disponible para editar.'
      else if (need?.status === 'cerrada') blocked.value = 'Esta necesidad ya está cerrada y no se puede editar.'
      else if (!catalog.some(sector => sector.active)) blocked.value = 'No hay rubros disponibles. Solicita al equipo que complete el catálogo.'
    } catch (error) {
      if (current === generation) loadError.value = featureError(error, 'No se pudo cargar el formulario.')
    } finally {
      if (current === generation) loading.value = false
    }
  }

  async function save(form) {
    if (saving.value || blocked.value) return
    saving.value = true
    saveError.value = ''
    try {
      const result = await saveNeed(supabase, auth.user.id, form, previous.value)
      await router.push({ name: 'need-detail', params: { id: result.id } })
    } catch (error) {
      saveError.value = featureError(error, 'No se pudo guardar la necesidad. Tus datos siguen en el formulario.')
    } finally {
      saving.value = false
    }
  }
  function cancel() {
    router.push(id.value ? { name: 'need-detail', params: { id: id.value } } : { path: '/necesidades', query: { view: 'mine' } })
  }
  watch(id, load, { immediate: true })
  onBeforeUnmount(() => generation++)
</script>
