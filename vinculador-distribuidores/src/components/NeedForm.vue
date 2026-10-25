<template>
  <v-form :disabled="busy" @submit.prevent="submit">
    <v-text-field
      v-model="form.title"
      counter="120"
      :error-messages="errors.title"
      label="Título de la necesidad"
      maxlength="120"
    />

    <v-textarea
      v-model="form.description"
      counter="4000"
      :error-messages="errors.description"
      label="Descripción"
      maxlength="4000"
      rows="3"
    />

    <v-select v-model="form.nature" :error-messages="errors.nature" :items="NATURES" label="¿Qué necesitas?" />
    <SectorSelect v-model="form.sector_id" :disabled="busy" :error-messages="errors.sector_id" :sectors="sectors" />

    <h2 class="text-subtitle-1 mb-3">Ubicación de la necesidad</h2>
    <p class="text-body-2 text-medium-emphasis mb-3">Para servicios remotos, indica la ubicación de quien solicita el servicio.</p>

    <v-row density="compact">
      <v-col cols="12" sm="4"><v-text-field v-model="form.country" :error-messages="errors.country" label="País" maxlength="80" /></v-col>
      <v-col cols="12" sm="4"><v-text-field v-model="form.region" :error-messages="errors.region" label="Estado o región" maxlength="100" /></v-col>
      <v-col cols="12" sm="4"><v-text-field v-model="form.city" :error-messages="errors.city" label="Ciudad" maxlength="100" /></v-col>
    </v-row>

    <h2 class="text-subtitle-1 mb-3">Presupuesto total estimado</h2>

    <v-row density="compact">
      <v-col cols="12" sm="4"><v-text-field
        v-model="form.budget_min"
        :error-messages="errors.budget_min"
        label="Mínimo"
        min="0"
        step="0.01"
        type="number"
      /></v-col>

      <v-col cols="12" sm="4"><v-text-field
        v-model="form.budget_max"
        :error-messages="errors.budget_max"
        label="Máximo"
        min="0.01"
        step="0.01"
        type="number"
      /></v-col>

      <v-col cols="12" sm="4"><v-select v-model="form.currency" :error-messages="errors.currency" :items="['MXN', 'USD']" label="Moneda" /></v-col>
    </v-row>

    <div v-if="form.nature === 'bien'">
      <h2 class="text-subtitle-1 mb-3">Detalles de los bienes</h2>

      <v-row density="compact">
        <v-col cols="12" sm="6"><v-text-field
          v-model="form.quantity"
          :error-messages="errors.quantity"
          label="Cantidad"
          min="0.001"
          step="0.001"
          type="number"
        /></v-col>

        <v-col cols="12" sm="6"><v-text-field
          v-model="form.unit"
          :error-messages="errors.unit"
          label="Unidad"
          maxlength="40"
          placeholder="Piezas, kg, litros…"
        /></v-col>
      </v-row>

      <v-text-field v-model="form.delivery_date" :error-messages="errors.delivery_date" label="Fecha deseada de entrega (opcional)" type="date" />
    </div>

    <div v-else-if="form.nature === 'servicio'">
      <h2 class="text-subtitle-1 mb-3">Detalles del servicio</h2>
      <v-select v-model="form.service_mode" :error-messages="errors.service_mode" :items="SERVICE_MODES" label="Modalidad" />

      <v-textarea
        v-model="form.service_scope"
        counter="2000"
        :error-messages="errors.service_scope"
        label="Alcance y entregables esperados"
        maxlength="2000"
        rows="3"
      />

      <v-row density="compact">
        <v-col cols="12" sm="6"><v-text-field v-model="form.start_date" :error-messages="errors.start_date" label="Inicio deseado (opcional)" type="date" /></v-col>
        <v-col cols="12" sm="6"><v-text-field v-model="form.end_date" :error-messages="errors.end_date" label="Fin deseado (opcional)" type="date" /></v-col>
      </v-row>
    </div>

    <v-alert
      v-if="Object.keys(errors).length > 0"
      class="mb-4"
      role="alert"
      type="error"
      variant="tonal"
    >Revisa los campos señalados antes de guardar.</v-alert>

    <div class="d-flex flex-wrap justify-end ga-2">
      <v-btn :disabled="busy" variant="text" @click="$emit('cancel')">Cancelar</v-btn>
      <v-btn color="primary" :loading="busy" type="submit">{{ initial ? 'Guardar cambios' : 'Publicar necesidad' }}</v-btn>
    </div>
  </v-form>
</template>

<script setup>
  import { ref } from 'vue'
  import { NATURES, SERVICE_MODES } from '@/lib/classification'
  import { emptyNeed, validateNeed } from '@/lib/needs'
  import SectorSelect from './SectorSelect.vue'

  const props = defineProps({ initial: { type: Object, default: null }, sectors: { type: Array, required: true }, busy: Boolean })
  const emit = defineEmits(['save', 'cancel'])
  const form = ref(Object.fromEntries(Object.entries(emptyNeed()).map(([key, value]) => [key, props.initial?.[key] ?? value])))
  const errors = ref({})
  function submit() {
    if (props.busy) return
    errors.value = validateNeed(form.value)
    if (!props.sectors.some(sector => sector.active && sector.id === form.value.sector_id)) errors.value.sector_id = 'Selecciona un rubro disponible.'
    if (Object.keys(errors.value).length === 0) emit('save', { ...form.value })
  }
</script>
