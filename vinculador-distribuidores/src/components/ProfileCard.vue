<template>
  <v-card class="mb-4 pa-4 pa-md-6">
    <div class="d-flex align-start ga-4">
      <v-avatar class="flex-shrink-0" color="primary" rounded="lg" size="48" variant="tonal">
        <v-img v-if="profile.avatar_url" :alt="`Logo de ${name}`" cover :src="profile.avatar_url" />
        <span v-else aria-hidden="true" class="font-weight-bold">{{ initialsText }}</span>
      </v-avatar>

      <div class="card-main">
        <RouterLink class="text-h6 text-decoration-none text-break" :to="profileLink">
          {{ name }}
        </RouterLink>

        <div class="d-flex flex-wrap align-center ga-2 mt-2">
          <v-chip v-if="profile.role" :color="ROLE_COLORS[profile.role]" size="small" variant="tonal">
            {{ roleLabel }}
          </v-chip>
          <span v-if="profile.rubro" class="text-body-2 text-muted">{{ profile.rubro }}</span>
        </div>
      </div>
    </div>

    <p v-if="profile.bio" class="description mt-4 text-break">{{ profile.bio }}</p>

    <div v-if="tags.length > 0" class="d-flex flex-wrap align-center ga-2 mt-4">
      <v-chip
        v-for="tag in visibleTags"
        :key="tag.id"
        :aria-label="`Buscar empresas con la especialidad ${tag.name}`"
        color="primary"
        size="small"
        :to="tagLink(tag.name)"
        variant="tonal"
      >
        {{ tag.name }}
      </v-chip>
      <span v-if="extraTags > 0" class="text-body-2 text-muted">+{{ extraTags }}</span>
    </div>

    <div class="mt-4">
      <v-btn :aria-label="`Ver perfil de ${name}`" :to="profileLink" variant="tonal">
        Ver perfil
      </v-btn>
    </div>
  </v-card>
</template>

<script setup>
  import { computed } from 'vue'
  import { useRoute } from 'vue-router'
  import { initials } from '@/lib/initials'
  import { ROLE_COLORS, ROLE_LABELS } from '@/lib/roles'
  import { searchParam } from '@/lib/searchUtils'

  const props = defineProps({ profile: { type: Object, required: true } })
  const route = useRoute()

  const name = computed(() => props.profile.full_name || 'Empresa sin nombre')
  const initialsText = computed(() => initials(props.profile.full_name))
  const roleLabel = computed(() => ROLE_LABELS[props.profile.role] || props.profile.role)
  const profileLink = computed(() => ({ name: 'user-profile', params: { id: props.profile.id } }))
  const tags = computed(() => (props.profile.profile_tags ?? []).map(row => row.tags).filter(Boolean))
  const visibleTags = computed(() => tags.value.slice(0, 3))
  const extraTags = computed(() => Math.max(0, tags.value.length - 3))

  function tagLink(tag) {
    const q = searchParam(route.query.q)
    return { path: '/perfiles', query: { ...(q ? { q } : {}), tag } }
  }
</script>

<style scoped>
  .card-main {
    flex: 1 1 0;
    min-width: 0;
  }

  .description {
    display: -webkit-box;
    -webkit-line-clamp: 3;      /* descripción breve: máximo 3 líneas */
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>