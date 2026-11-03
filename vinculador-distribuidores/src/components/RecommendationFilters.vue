<template>
  <section aria-label="Filtrar recomendaciones" class="recommendation-filters">
    <div class="d-flex flex-wrap ga-3 align-center">
      <v-select
        clearable
        hide-details
        :items="NATURES"
        label="Naturaleza de la oferta"
        :model-value="store.nature"
        @update:model-value="store.setFilters({ nature: $event, sectorId: store.sectorId })"
      />

      <v-autocomplete
        clearable
        :disabled="Boolean(error) || loading"
        hide-details
        item-title="name"
        item-value="id"
        :items="sectors"
        label="Rubro de la empresa"
        :loading="loading"
        :model-value="store.sectorId"
        no-data-text="No hay rubros que coincidan"
        @update:model-value="store.setFilters({ nature: store.nature, sectorId: $event })"
      />

      <v-btn v-if="store.hasFilters" variant="text" @click="store.setFilters()">Limpiar filtros</v-btn>
    </div>

    <p class="text-caption text-muted mt-1">Los filtros usan la clasificación de la empresa que publicó.</p>

    <v-alert v-if="error" class="mt-2" density="compact" type="warning">
      {{ error }} <v-btn variant="text" @click="load">Reintentar catálogo</v-btn>
    </v-alert>
  </section>
</template>

<script setup>
  import { onMounted, ref } from 'vue'
  import { listSectors, NATURES } from '@/lib/classification'
  import { supabase } from '@/lib/supabase'
  import { useRecommendationsStore } from '@/stores/recommendations'
  const store = useRecommendationsStore()
  const sectors = ref([])
  const loading = ref(false)
  const error = ref('')
  async function load() {
    loading.value = true
    error.value = ''
    try {
      sectors.value = (await listSectors(supabase)).filter(sector => sector.active)
    } catch {
      error.value = 'No se pudo cargar el catálogo de rubros.'
    } finally {
      loading.value = false
    }
  }
  onMounted(load)
</script>

<style scoped>
  .recommendation-filters { margin-top: 16px; }
  .recommendation-filters .v-input { flex: 1 1 200px; min-width: 0; }
</style>
