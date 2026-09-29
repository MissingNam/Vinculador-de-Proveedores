<template>
  <v-card class="mb-4 pa-4">
    <div class="d-flex align-center ga-3">
      <v-avatar color="primary" size="56">
        <v-img v-if="profile.avatar_url" alt="Foto de perfil" :src="profile.avatar_url" />
        <v-icon v-else icon="mdi-account" />
      </v-avatar>

      <div class="flex-grow-1" style="min-width: 0">
        <RouterLink class="text-h6 text-decoration-none text-break" :to="profileLink">
          {{ profile.full_name || 'Perfil sin nombre' }}
        </RouterLink>

        <div v-if="profile.role" class="text-medium-emphasis">{{ roleLabel }}</div>
      </div>
    </div>

    <p v-if="profile.bio" class="mt-3 text-break">{{ profile.bio }}</p>

    <div v-if="tags.length > 0" class="mt-3">
      <v-chip
        v-for="tag in tags"
        :key="tag.id"
        :aria-label="`Buscar perfiles con la etiqueta ${tag.name}`"
        class="mr-1 mb-1"
        size="small"
        :to="tagLink(tag.name)"
      >
        {{ tag.name }}
      </v-chip>
    </div>

    <v-btn :aria-label="`Ver perfil de ${profile.full_name || 'usuario'}`" class="mt-3" :to="profileLink" variant="text">
      Ver perfil
    </v-btn>
  </v-card>
</template>

<script setup>
  import { computed } from 'vue'
  import { useRoute } from 'vue-router'
  import { searchParam } from '@/lib/searchUtils'

  const props = defineProps({ profile: { type: Object, required: true } })
  const route = useRoute()
  const profileLink = computed(() => ({ name: 'user-profile', params: { id: props.profile.id } }))
  const roleLabel = computed(() => ({ proveedor: 'Proveedor', cliente: 'Cliente' })[props.profile.role] || props.profile.role)
  const tags = computed(() => (props.profile.profile_tags ?? []).map(row => row.tags).filter(Boolean))

  function tagLink(tag) {
    const q = searchParam(route.query.q)
    return { path: '/perfiles', query: { ...(q ? { q } : {}), tag } }
  }
</script>
