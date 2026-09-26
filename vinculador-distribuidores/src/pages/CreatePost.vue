<template>
  <v-container max-width="600">
    <v-card class="pa-6">
      <v-card-title>Nueva publicación</v-card-title>
      <v-text-field v-model="title" label="Título" />
      <v-textarea v-model="description" label="Descripción" />
      <v-file-input
        v-model="imageFile"
        label="Imagen (opcional)"
        accept="image/png, image/jpeg"
        prepend-icon="mdi-image"
      />
      <v-combobox v-model="tags" label="Etiquetas" multiple chips clearable />
      <v-btn color="primary" block :loading="uploading" @click="submit">Publicar</v-btn>
    </v-card>
  </v-container>
</template>


<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const title = ref('')
const description = ref('')
const tags = ref([])
const imageFile = ref(null)
const uploading = ref(false)
const authStore = useAuthStore()
const router = useRouter()

async function submit() {
  uploading.value = true
  let imageUrl = null

  if (imageFile.value) {
    const file = imageFile.value
    const path = `${authStore.user.id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('post-images')
      .upload(path, file)

    if (!uploadError) {
      const { data } = supabase.storage.from('post-images').getPublicUrl(path)
      imageUrl = data.publicUrl
    }
  }

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      title: title.value,
      description: description.value,
      author_id: authStore.user.id,
      image_url: imageUrl,
    })
    .select()
    .single()

  uploading.value = false
  if (error) return

  for (const tagName of tags.value) {
    let { data: tag } = await supabase.from('tags').select('id').eq('name', tagName).single()
    if (!tag) {
      const { data: newTag } = await supabase.from('tags').insert({ name: tagName }).select().single()
      tag = newTag
    }
    await supabase.from('post_tags').insert({ post_id: post.id, tag_id: tag.id })
  }
  router.push('/')
}
</script>

