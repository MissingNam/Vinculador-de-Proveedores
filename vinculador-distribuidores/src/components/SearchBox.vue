<template>
  <v-text-field
    v-model="text"
    :aria-label="placeholder"
    bg-color="surface"
    clearable
    hide-details
    :placeholder="placeholder"
    @click:clear="clear"
    @keydown.enter.prevent="search"
  >
    <template #prepend-inner>
      <v-btn aria-label="Buscar" icon="mdi-magnify" size="small" variant="text" @click="search" />
    </template>
  </v-text-field>
</template>

<script setup>
  import { ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { searchParam } from '@/lib/searchUtils'

  const props = defineProps({
    placeholder: { type: String, required: true },
    path: { type: String, default: '/' },
  })

  const route = useRoute()
  const router = useRouter()
  const text = ref(searchParam(route.query.q))

  watch(() => route.query.q, value => {
    text.value = searchParam(value)
  })

  function search() {
    const q = searchParam(text.value)
    text.value = q
    const tag = searchParam(route.query.tag)
    router.push({ path: props.path, query: { ...(q ? { q } : {}), ...(tag ? { tag } : {}) } })
  }

  function clear() {
    text.value = ''
    search()
  }
</script>