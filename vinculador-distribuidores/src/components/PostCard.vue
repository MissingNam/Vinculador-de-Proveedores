<template>
  <v-card class="mb-4">
    <v-card-title class="d-flex align-center justify-space-between">
      {{ post.title }}
      <v-btn v-if="isOwner" icon="mdi-delete" size="small" variant="text"
             :loading="deleting" @click="deletePost" />
    </v-card-title>
    <v-card-subtitle>{{ post.profiles?.full_name }}</v-card-subtitle>
    <v-card-text>
      {{ post.description }}
      <div class="mt-2">
        <v-chip v-for="t in post.post_tags" :key="t.tags.id" size="small" class="mr-1">
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
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  post: Object,
  readonly: { type: Boolean, default: false }, // oculta me interesa/no me interesa
})
const emit = defineEmits(['deleted'])

const authStore = useAuthStore()
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
  deleting.value = false
  if (!error) emit('deleted', props.post.id)
}
</script>

