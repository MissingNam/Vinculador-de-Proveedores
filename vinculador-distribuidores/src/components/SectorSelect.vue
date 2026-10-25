<template>
  <v-autocomplete
    v-model="value"
    clearable
    :disabled="disabled"
    :error-messages="errorMessages"
    item-title="name"
    item-value="id"
    :items="options"
    label="Rubro"
    no-data-text="No hay rubros que coincidan"
  />
</template>

<script setup>
  import { computed } from 'vue'
  const value = defineModel({ type: String, default: null })
  const props = defineProps({
    sectors: { type: Array, default: () => [] },
    disabled: Boolean,
    errorMessages: { type: [String, Array], default: '' },
  })
  const options = computed(() => props.sectors.map(sector => ({
    ...sector, name: sector.active ? sector.name : `${sector.name} (no disponible)`, props: { disabled: !sector.active },
  })))
</script>
