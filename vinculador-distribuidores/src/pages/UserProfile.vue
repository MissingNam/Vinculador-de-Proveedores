<template>
  <v-container max-width="700" v-if="profile">
    <v-card class="pa-6 mb-6">
      <div class="d-flex align-center">
        <v-avatar size="64" color="primary" class="mr-4">
          <v-img v-if="profile.avatar_url" :src="profile.avatar_url" />
          <v-icon v-else size="36">mdi-account</v-icon>
        </v-avatar>
        <div>
          <div class="text-h5">{{ profile.full_name }}</div>
          <v-chip size="small" :color="profile.role === 'proveedor' ? 'blue' : 'green'">
            {{ profile.role }}
          </v-chip>
        </div>
      </div>
      <p v-if="profile.bio" class="mt-4">{{ profile.bio }}</p>

      <div v-if="tags.length" class="mt-3">
        <v-chip v-for="t in tags" :key="t.id" size="small" class="mr-1 mb-1">{{ t.name }}</v-chip>
      </div>

      <div v-if="links.length" class="mt-3">
        <div v-for="link in links" :key="link.id">
        <a :href="link.url" target="_blank" rel="noopener noreferrer">
            {{ link.label || link.url }}
            </a>
        </div>
      </div>
    </v-card>

    <div class="text-h6 mb-3">Publicaciones</div>
    <v-progress-circular v-if="loading" indeterminate class="d-block mx-auto" />
    <PostCard v-for="post in posts" :key="post.id" :post="post" readonly />
  </v-container>
</template>


<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import PostCard from '@/components/PostCard.vue'

const route = useRoute()
const profile = ref(null)
const posts = ref([])
const loading = ref(true)
const tags = ref([])
const links = ref([])

async function loadUser(id) {
  loading.value = true
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()
  profile.value = profileData

  const { data: postsData } = await supabase
    .from('posts')
    .select('*, profiles(full_name), post_tags(tags(id, name))')
    .eq('author_id', id)
    .order('created_at', { ascending: false })
  posts.value = postsData ?? []
  loading.value = false

  const { data: tagsData } = await supabase
    .from('profile_tags')
    .select('tags(id, name)')
    .eq('profile_id', id)
  tags.value = (tagsData ?? []).map(row => row.tags)

  const { data: linksData } = await supabase
    .from('profile_links')
    .select('*')
    .eq('profile_id', id)
    .order('created_at', { ascending: true })
  links.value = linksData ?? []
}

onMounted(() => loadUser(route.params.id))
watch(() => route.params.id, (newId) => loadUser(newId))
</script>

