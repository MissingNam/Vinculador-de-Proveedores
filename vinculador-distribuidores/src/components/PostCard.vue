<template>
  <v-card v-if="!removed" class="mb-4">

    <v-tooltip v-if="affinity !== null" location="bottom" max-width="260" open-on-click>
      <template #activator="{ props: tooltipProps }">
        <v-chip
          v-bind="tooltipProps"
          :aria-label="`Afinidad con tu perfil: ${affinityLabel}`"
          class="affinity-badge"
          :color="affinityColor"
          size="small"
          tabindex="0"
          variant="tonal"
        >
          {{ affinityLabel }}
        </v-chip>
      </template>

      <div class="text-body-2 font-weight-bold mb-2">Puntaje por etiqueta</div>
      <div v-if="tagScores.length === 0">Este post no tiene etiquetas.</div>

      <div v-for="t in tagScores" :key="t.id" class="d-flex justify-space-between ga-4">
        <span>{{ t.name }}</span>
        <span class="font-weight-bold" :class="scoreClass(t.score)">{{ scoreLabel(t.score) }}</span>
      </div>
    </v-tooltip>
    
    <v-card-title class="d-flex align-center justify-space-between" :class="{ 'pr-16': affinity !== null }">
      {{ post.title }}
      
      <v-btn
        v-if="isOwner && !removed"
        icon="mdi-delete"
        :loading="deleting"
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

      <div class="d-flex flex-wrap ga-2 mt-4">
        <v-chip
          v-for="t in visibleTags"
          :key="t.tags.id"
          :aria-label="`Buscar publicaciones con la etiqueta ${t.tags.name}`"
          size="small"
          :to="tagLink(t.tags.name)"
        >
          {{ t.tags.name }}
        </v-chip>
      </div>

      <div v-if="offerNature" aria-label="Clasificación de la oferta" class="d-flex flex-wrap ga-2 mt-3">
        <v-chip color="primary" :to="{ path: '/', query: { nature: offerNature } }">{{ natureLabel(offerNature) }}</v-chip>
        <v-chip v-if="offerSector" color="secondary" :to="{ path: '/', query: { sector: offerSector } }">{{ offerSectorName || offerSector }}</v-chip>
      </div>

      <RecommendationExplanation :post="post" />
    </v-card-text>

    <v-alert v-if="actionError" class="mx-4 mb-3" role="alert" type="error">{{ actionError }}</v-alert>

    <v-card-actions v-if="!readonly && !authStore.isGuest">
      <v-btn :color="myReaction === true ? 'secondary' : 'muted'" :disabled="reacting || deleting" @click="react(true)">Me Interesa</v-btn>
      <v-btn :color="myReaction === false ? 'error' : 'muted'" :disabled="reacting || deleting" @click="react(false)">No me Interesa</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup>
  import { computed, onMounted, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import RecommendationExplanation from '@/components/RecommendationExplanation.vue'
  import { natureLabel } from '@/lib/classification'
  import { removePost, saveReaction } from '@/lib/offers'
  import { searchParam } from '@/lib/postSearch'
  import { supabase } from '@/lib/supabase'
  import { useAuthStore } from '@/stores/auth'

  const props = defineProps({
    post: Object,
    readonly: { type: Boolean, default: false }, // oculta me interesa/no me interesa
  })
  const emit = defineEmits(['deleted'])

  // Desglose por etiqueta (viene de user_tag_scores en la misma consulta); sin fila = 0
  const tagScores = computed(() => visibleTags.value.map(t => ({
    id: t.tags.id,
    name: t.tags.name,
    score: t.tags.user_tag_scores?.[0]?.score ?? 0,
  })))
  

  const authStore = useAuthStore()
  const route = useRoute()
  const visibleTags = computed(() => (props.post.post_tags ?? []).filter(t => t.tags))
  const roleLabel = computed(() => {
    const role = props.post.profiles?.role
    return role ? role.charAt(0).toUpperCase() + role.slice(1) : '' })
  const affinity = computed(() => {
    if (authStore.isGuest) return null
    const value = props.post.affinity
    return value == null ? null : Math.round(Number(value) * 10) / 10})
  const affinityLabel = computed(() => (affinity.value > 0 ? '+' : '') + affinity.value)
  const affinityColor = computed(() => (affinity.value > 0 ? 'success' : (affinity.value < 0 ? 'error' : 'muted')))

  function scoreClass(score) {
    if (score > 0) return 'text-success'
    if (score < 0) return 'text-error'
    return 'text-muted'
  }

  function scoreLabel(score) {
    return (score > 0 ? '+' : '') + score
  }
     
  function tagLink(tag) {
    const q = ['/', '/feed'].includes(route.path) ? searchParam(route.query.q) : ''
    return { path: '/', query: { ...(q ? { q } : {}), tag } }
  }
  const myReaction = ref(props.post.myReaction ?? null)
  const isOwner = computed(() => !authStore.isGuest && authStore.user?.id === props.post.author_id)
  const deleting = ref(false)

  const reacting = ref(false), actionError = ref(''), removed = ref(false)
  const offerNature = computed(() => props.post.nature ?? props.post.recommendation?.offer_nature)
  const offerSector = computed(() => props.post.sector_id ?? props.post.recommendation?.offer_sector_id)
  const offerSectorName = computed(() => props.post.sectors?.name ?? props.post.recommendation?.offer_sector_name)

  let reactionTouched = false
  onMounted(async () => {
    if (!authStore.user || authStore.isGuest || props.readonly) return
    const { data, error } = await supabase.from('reactions').select('interested').eq('post_id', props.post.id).eq('user_id', authStore.user.id).maybeSingle()
    if (!error && data && !reactionTouched) myReaction.value = data.interested
  })

  async function react(interested) {
    if (reacting.value || !authStore.user || authStore.isGuest) return
    reactionTouched = true
    reacting.value = true
    actionError.value = ''
    try { myReaction.value = await saveReaction(supabase, props.post.id, authStore.user.id, interested) }
    catch (error) { actionError.value = error.message }
    finally { reacting.value = false }
  }

  async function deletePost() {
    if (deleting.value || !isOwner.value || !confirm('¿Eliminar esta publicación?')) return
    deleting.value = true
    actionError.value = ''
    try {
      await removePost(supabase, props.post.id, authStore.user.id)
      removed.value = true
      emit('deleted', props.post.id)
    } catch (error) { actionError.value = error.message }
    finally { deleting.value = false }
  }
</script>


<style scoped>
  .affinity-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 1;
  }
</style>
