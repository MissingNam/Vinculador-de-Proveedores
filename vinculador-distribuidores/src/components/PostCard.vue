<template>
  <v-card class="mb-4">
    
    <v-card-title class="d-flex align-center justify-space-between">
      {{ post.title }}
      <v-btn
        v-if="isOwner"
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

