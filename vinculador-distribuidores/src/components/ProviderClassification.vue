<template>
  <section aria-label="Clasificación del proveedor" class="mt-4">
    <div class="d-flex align-center justify-space-between mb-2">
      <h2 class="text-subtitle-1">Clasificación del proveedor</h2>

      <v-btn
        v-if="editable && !loading && !error"
        aria-label="Editar clasificación"
        icon="mdi-pencil"
        size="small"
        variant="text"
        @click="openEditor"
      />
    </div>

    <v-progress-linear v-if="loading" aria-label="Cargando clasificación" indeterminate />

    <v-alert v-else-if="error" density="compact" type="warning" variant="tonal">
      {{ error }}
      <v-btn size="small" variant="text" @click="load">Reintentar</v-btn>
    </v-alert>

    <div v-else-if="classification" class="d-flex flex-wrap ga-2">
      <v-chip color="primary" variant="tonal">{{ natureLabel(classification.nature) }}</v-chip>
      <v-chip>{{ classification.sectors?.name || 'Rubro no disponible' }}</v-chip>
    </div>

    <div v-else>
      <p class="text-medium-emphasis">Todavía no se ha definido la naturaleza y el rubro.</p>
      <v-btn v-if="editable" class="mt-2" variant="tonal" @click="openEditor">Completar clasificación</v-btn>
    </div>

    <v-dialog v-model="editing" max-width="520" :persistent="saving">
      <v-card title="Clasificación del proveedor">
        <v-card-text>
          <p class="mb-4">Indica qué ofreces y tu rubro principal.</p>
          <v-progress-linear v-if="catalogLoading" indeterminate />
          <v-select v-model="form.nature" :disabled="saving || catalogLoading" :items="PROVIDER_NATURES" label="Naturaleza de la oferta" />
          <SectorSelect v-model="form.sector_id" :disabled="saving || catalogLoading" :sectors="sectors" />
          <v-alert v-if="saveError" role="alert" type="error" variant="tonal">{{ saveError }}</v-alert>
          <v-btn v-if="catalogFailed" class="mt-2" variant="text" @click="loadCatalog">Reintentar catálogo</v-btn>
        </v-card-text>

        <v-card-actions>
          <v-btn :disabled="saving" @click="editing = false">Cancelar</v-btn>
          <v-btn color="primary" :disabled="catalogLoading || catalogFailed" :loading="saving" @click="save">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="saved" :timeout="3500">Clasificación guardada.</v-snackbar>
  </section>
</template>

<script setup>
  import { onBeforeUnmount, ref, watch } from 'vue'
  import { featureError, getClassification, listSectors, natureLabel, PROVIDER_NATURES, saveClassification } from '@/lib/classification'
  import { supabase } from '@/lib/supabase'
  import SectorSelect from './SectorSelect.vue'

  const props = defineProps({ profileId: { type: String, required: true }, editable: Boolean })
  const classification = ref(null)
  const sectors = ref([])
  const loading = ref(true)
  const error = ref('')
  const editing = ref(false)
  const form = ref({ nature: '', sector_id: null })
  const saving = ref(false)
  const saved = ref(false)
  const saveError = ref('')
  const catalogLoading = ref(false)
  const catalogFailed = ref(false)
  let generation = 0

  async function load() {
    const current = ++generation
    loading.value = true
    error.value = ''
    try {
      const result = await getClassification(supabase, props.profileId)
      if (current === generation) classification.value = result
    } catch (error_) {
      if (current === generation) error.value = featureError(error_, 'No se pudo cargar la clasificación.')
    } finally {
      if (current === generation) loading.value = false
    }
  }

  async function loadCatalog() {
    catalogLoading.value = true
    catalogFailed.value = false
    saveError.value = ''
    try {
      sectors.value = await listSectors(supabase)
    } catch (error_) {
      catalogFailed.value = true
      saveError.value = featureError(error_, 'No se pudo cargar el catálogo de rubros.')
    } finally {
      catalogLoading.value = false
    }
  }

  function openEditor() {
    form.value = { nature: classification.value?.nature ?? '', sector_id: classification.value?.sector_id ?? null }
    editing.value = true
    loadCatalog()
  }

  async function save() {
    if (saving.value) return
    saveError.value = ''
    if (!sectors.value.some(sector => sector.active && sector.id === form.value.sector_id)) {
      saveError.value = 'Selecciona un rubro disponible.'
      return
    }
    saving.value = true
    try {
      classification.value = await saveClassification(supabase, props.profileId, form.value, classification.value)
      editing.value = false
      saved.value = true
    } catch (error_) {
      saveError.value = featureError(error_)
    } finally {
      saving.value = false
    }
  }

  watch(() => props.profileId, load, { immediate: true })
  onBeforeUnmount(() => generation++)
</script>
