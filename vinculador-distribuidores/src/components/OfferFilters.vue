<template>
  <div>
    <div class="d-flex flex-wrap ga-3">
      <v-select
        clearable
        hide-details
        :items="NATURES"
        label="Naturaleza de la oferta"
        :model-value="nature"
        @update:model-value="$emit('update:nature', $event)"
      />

      <v-autocomplete
        clearable
        hide-details
        item-title="name"
        item-value="id"
        :items="sectors"
        label="Rubro de la oferta"
        :loading="loading"
        :model-value="sectorId"
        @update:model-value="$emit('update:sector-id', $event)"
      />
    </div>

    <v-alert v-if="error" class="mt-2" type="warning">{{ error }} <v-btn variant="text" @click="load">Reintentar catálogo</v-btn></v-alert>
  </div>
</template>
<script setup>
  import { onMounted, ref } from 'vue'
  import { listSectors, NATURES } from '@/lib/classification'
  import { supabase } from '@/lib/supabase'
  defineProps({ nature: String, sectorId: String })
  defineEmits(['update:nature', 'update:sector-id'])
  const sectors = ref([]), loading = ref(false), error = ref('')
  async function load() {
    loading.value = true
    error.value = ''
    try { sectors.value = (await listSectors(supabase)).filter(sector => sector.active) }
    catch { error.value = 'No se pudieron cargar los rubros.' }
    finally { loading.value = false }
  }
  onMounted(load)
</script>
<style scoped>
  .v-input { flex: 1 1 200px; min-width: 0; }
</style>
