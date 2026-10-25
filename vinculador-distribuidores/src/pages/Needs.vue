<template>
  <v-container max-width="900">
    <div class="d-flex flex-wrap align-center justify-space-between ga-4 mb-4">
      <h1 class="page-title mb-0">Necesidades</h1>
      <v-btn color="primary" prepend-icon="mdi-plus" to="/necesidades/nueva">Crear Necesidad</v-btn>
    </div>

    <v-tabs class="mb-4" :model-value="mine ? 'mine' : 'all'" @update:model-value="setFilter('view', $event === 'mine' ? 'mine' : '')">
      <v-tab value="all">Necesidades abiertas</v-tab>
      <v-tab value="mine">Mis necesidades</v-tab>

    </v-tabs>

    <v-card class="pa-4 pa-md-6 mb-4">
      <v-text-field
        v-model="input"
        clearable
        hide-details
        label="Buscar por título o descripción"
        prepend-inner-icon="mdi-magnify"
        @click:clear="setFilter('q', '')"
        @keydown.enter.prevent="setFilter('q', input)"
      >
        <template #append-inner><v-btn aria-label="Buscar necesidades" icon="mdi-magnify" variant="text" @click="setFilter('q', input)" /></template>
      </v-text-field>

      <v-row class="mt-2" density="compact">
        <v-col cols="12" sm="4"><v-select
          clearable
          hide-details
          :items="NATURES"
          label="Naturaleza"
          :model-value="nature || null"
          @update:model-value="setFilter('nature', $event)"
        /></v-col>

        <v-col cols="12" sm="4"><v-select
          clearable
          hide-details
          item-title="name"
          item-value="id"
          :items="sectors"
          label="Rubro"
          :model-value="sector || null"
          @update:model-value="setFilter('sector', $event)"
        /></v-col>

        <v-col v-if="mine" cols="12" sm="4"><v-select
          clearable
          hide-details
          :items="statuses"
          label="Estado"
          :model-value="status || null"
          @update:model-value="setFilter('status', $event)"
        /></v-col>
      </v-row>

      <v-btn class="mt-2" :to="{ path: '/necesidades', query: mine ? { view: 'mine' } : {} }" variant="text">Limpiar filtros</v-btn>
    </v-card>

    <v-progress-linear v-if="loading" aria-label="Cargando necesidades" indeterminate />
    <v-alert v-else-if="error" type="error" variant="tonal">{{ error }} <v-btn variant="text" @click="load">Reintentar</v-btn></v-alert>

    <template v-else>
      <p class="text-muted mb-4" role="status">{{ total }} {{ total === 1 ? 'necesidad encontrada' : 'necesidades encontradas' }}</p>
      <v-alert v-if="needs.length === 0" type="info" variant="tonal">No hay necesidades con estos filtros.</v-alert>

      <v-card v-for="need in needs" :key="need.id" class="mb-4 pa-4 pa-md-6">
        <div class="d-flex flex-wrap ga-2 mb-2">
          <v-chip color="primary" size="small" variant="tonal">{{ natureLabel(need.nature) }}</v-chip>
          <v-chip color="secondary" size="small" variant="tonal">{{ need.sectors?.name }}</v-chip>
          <v-chip :color="need.status === 'abierta' ? 'success' : 'muted'" size="small" variant="tonal">{{ need.status === 'abierta' ? 'Abierta' : 'Cerrada' }}</v-chip>
        </div>

        <RouterLink class="text-h6 text-decoration-none text-break" :to="{ name: 'need-detail', params: { id: need.id } }">{{ need.title }}</RouterLink>
        <p class="mt-2 text-break">{{ need.description.length > 220 ? `${need.description.slice(0, 220)}…` : need.description }}</p>
        <p class="mt-2">{{ need.city }}, {{ need.region }}, {{ need.country }}</p>
        <p>{{ money(need.budget_min, need.currency) }} – {{ money(need.budget_max, need.currency) }}</p>
        <p class="text-body-2 text-muted mt-2">Por {{ need.profiles?.full_name || 'Usuario' }}</p>
        <v-btn class="mt-4" :to="{ name: 'need-detail', params: { id: need.id } }" variant="tonal">Ver necesidad</v-btn>
      </v-card>

      <v-pagination
        v-if="pageCount > 1"
        aria-label="Páginas de necesidades"
        :length="pageCount"
        :model-value="page"
        :total-visible="5"
        @update:model-value="changePage"
      />
    </template>
  </v-container>
</template>

<script setup>
  import { computed, onBeforeUnmount, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { featureError, listSectors, natureLabel, NATURES } from '@/lib/classification'
  import { listNeeds, NEEDS_PAGE_SIZE } from '@/lib/needs'
  import { searchParam } from '@/lib/searchUtils'
  import { supabase } from '@/lib/supabase'
  import { useAuthStore } from '@/stores/auth'
  const route = useRoute()
  const router = useRouter()
  const auth = useAuthStore()
  const mine = computed(() => route.query.view === 'mine')
  const text = computed(() => searchParam(route.query.q))
  const nature = computed(() => searchParam(route.query.nature))
  const sector = computed(() => searchParam(route.query.sector))
  const status = computed(() => mine.value ? searchParam(route.query.status) : '')
  const page = computed(() => {
    const value = Number(searchParam(route.query.page))
    return Number.isSafeInteger(value) && value > 0 && value <= 1_000_000 ? value : 1
  })
  const input = ref('')
  const sectors = ref([])
  const needs = ref([])
  const total = ref(0)
  const loading = ref(true)
  const error = ref('')
  const pageCount = computed(() => Math.ceil(total.value / NEEDS_PAGE_SIZE))
  const statuses = [{ title: 'Abiertas', value: 'abierta' }, { title: 'Cerradas', value: 'cerrada' }]
  let request
  const money = (amount, currency) => new Intl.NumberFormat('es-MX', { style: 'currency', currency, currencyDisplay: 'code' }).format(amount)

  async function load() {
    request?.abort()
    const current = new AbortController()
    request = current
    loading.value = true
    error.value = ''
    try {
      const [catalog, result] = await Promise.all([
        sectors.value.length > 0 ? sectors.value : listSectors(supabase),
        listNeeds(supabase, { text: text.value, nature: nature.value, sector: sector.value,
                              ownerId: mine.value ? auth.user.id : '', status: status.value, page: page.value, signal: current.signal }),
      ])
      if (current.signal.aborted) return
      sectors.value = catalog
      needs.value = result.needs
      total.value = result.total
      const last = Math.max(1, Math.ceil(total.value / NEEDS_PAGE_SIZE))
      if (page.value > last) await router.replace({ path: '/necesidades', query: { ...route.query, page: last === 1 ? undefined : String(last) } })
    } catch (error_) {
      if (!current.signal.aborted) error.value = featureError(error_, 'No se pudieron cargar las necesidades.')
    } finally {
      if (request === current) loading.value = false
    }
  }
  function setFilter(key, value) {
    const query = { ...route.query }
    const normalized = searchParam(value)
    if (normalized) query[key] = normalized
    else delete query[key]
    delete query.page
    if (key === 'view') delete query.status
    router.push({ path: '/necesidades', query })
  }
  function changePage(value) {
    router.push({ path: '/necesidades', query: { ...route.query, page: value === 1 ? undefined : String(value) } })
  }
  watch(text, value => { input.value = value }, { immediate: true })
  watch([mine, text, nature, sector, status, page], load, { immediate: true })
  onBeforeUnmount(() => request?.abort())
</script>