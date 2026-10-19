<template>
  <v-card class="mb-4">

    <v-tooltip v-if="affinity !== null" location="bottom" max-width="260" open-on-click>
      <template #activator="{ props: tooltipProps }">
        <v-chip
          v-bind="tooltipProps"
          :aria-label="`Afinidad con tu perfil: ${affinityLabel}`"
          class="affinity-badge"
          :color="affinityColor"
          size="small"
          tabindex="0"
          variant="flat"
        >
          {{ affinityLabel }}
        </v-chip>
      </template>

      <div class="text-caption font-weight-bold mb-1">Puntaje por etiqueta</div>

      <div v-if="tagScores.length === 0">Este post no tiene etiquetas.</div>

      <div v-for="t in tagScores" :key="t.id" class="d-flex justify-space-between ga-4">
        <span>{{ t.name }}</span>
        <span class="font-weight-bold" :class="scoreClass(t.score)">{{ scoreLabel(t.score) }}</span>
      </div>
    </v-tooltip>
    
    <v-card-title class="d-flex align-center justify-space-between">
      {{ post.title }}
      <v-btn
        v-if="isOwner"
        icon="mdi-delete"
        :loading="deleting"
        :class="{ 'pr-16': affinity !== null }"
        size="small"
        variant="text"
        @click="deletePost"
      />
    </v-card-title>

    <v-card-subtitle>
      <RouterLink class="text-decoration-none" :to="`/usuario/${post.author_id}`">
        {{ post.profiles?.full_name }}
      </RouterLink>
      <span v-if="roleLabel"> - {{ roleLabel }}</span>
    </v-card-subtitle>

    <v-card-text>
      {{ post.description }}
      <v-img
        v-if="post.image_url"
        cover
        height="300"
        :src="post.image_url"
        width="485"
      />

      <div class="mt-2">
        <v-chip
          v-for="t in visibleTags"
          :key="t.tags.id"
          :aria-label="`Buscar publicaciones con la etiqueta ${t.tags.name}`"
          class="mr-1 mb-1"
          size="small"
          :to="tagLink(t.tags.name)"
        >
          {{ t.tags.name }}
        </v-chip>
      </div>
    </v-card-text>

    <v-card-actions v-if="!readonly">
      <v-btn :color="myReaction === true ? 'green' : ''" @click="react(true)">
        <v-icon start>mdi-thumb-up</v-icon> Me interesa
      </v-btn>

      <v-btn :color="myReaction === false ? 'red' : ''" @click="react(false)">
        <v-icon start>mdi-thumb-down</v-icon> No me interesa
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<style scoped>
  .affinity-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 1;
  }
</style>


<script setup>
  import { computed, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import { searchParam } from '@/lib/postSearch'
  import { supabase } from '@/lib/supabase'
  import { useAuthStore } from '@/stores/auth'

  const props = defineProps({
    post: Object,
    readonly: { type: Boolean, default: false }, // oculta me interesa/no me interesa
  })
  const emit = defineEmits(['deleted'])
  

  const authStore = useAuthStore()
  const route = useRoute()
  const visibleTags = computed(() => (props.post.post_tags ?? []).filter(t => t.tags))
  const roleLabel = computed(() => {
  const role = props.post.profiles?.role
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : '' })
  const affinity = computed(() => {
  const value = props.post.affinity
  return value == null ? null : Math.round(Number(value) * 10) / 10})
  const affinityColor = computed(() => (affinity.value > 0 ? 'green' : affinity.value < 0 ? 'red' : 'grey'))
  const affinityLabel = computed(() => (affinity.value > 0 ? '+' : '') + affinity.value)
  const tagScores = computed(() =>
    visibleTags.value.map(t => ({
      id: t.tags.id,
      name: t.tags.name,
      score: t.tags.user_tag_scores?.[0]?.score ?? 0, // sin fila = nunca has reaccionado a esa etiqueta
    })),
  )

  function scoreLabel(score) {
    return (score > 0 ? '+' : '') + score
  }

  function scoreClass(score) {
    if (score > 0) return 'text-green-lighten-2'
    if (score < 0) return 'text-red-lighten-2'
    return 'text-grey-lighten-1'
  }
    
    

  function tagLink(tag) {
    const q = ['/', '/feed'].includes(route.path) ? searchParam(route.query.q) : ''
    return { path: '/', query: { ...(q ? { q } : {}), tag } }
  }
  const myReaction = ref(props.post.myReaction ?? null)
  const isOwner = authStore.user?.id === props.post.author_id
  const deleting = ref(false)

  async function react(interested) {
    myReaction.value = interested
    await supabase.from('reactions').upsert({
      post_id: props.post.id,
      user_id: authStore.user.id,
      interested,
    }, { onConflict: 'post_id,user_id' })
  }

  async function deletePost() {
    if (!confirm('¿Eliminar esta publicación?')) return
    deleting.value = true
    const { error } = await supabase.from('posts').delete().eq('id', props.post.id)
    window.location.reload()
    deleting.value = false
    if (!error) emit('deleted', props.post.id)
  }
</script>

