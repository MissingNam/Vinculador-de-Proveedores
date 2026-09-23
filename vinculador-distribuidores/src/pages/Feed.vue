<template>
  <v-container max-width="700">
    <PostCard v-for="post in posts" :key="post.id" :post="post" />
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import PostCard from '@/components/PostCard.vue'

const posts = ref([])

onMounted(async () => {
  const { data } = await supabase
    .from('posts')
    .select('*, profiles(full_name), post_tags(tags(id, name))')
    .order('created_at', { ascending: false })
  posts.value = data ?? []
})
</script>

