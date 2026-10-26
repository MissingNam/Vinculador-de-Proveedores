<template>
  <v-container max-width="600">
    <v-card class="pa-6">
      <v-card-title>Nueva publicación</v-card-title>
      <v-alert v-if="submitError" class="mb-4" role="alert" type="error" variant="tonal">{{ submitError }}</v-alert>
      <v-btn v-if="createdPost" class="mb-4" to="/perfil" variant="text">Ver mi perfil</v-btn>
      <v-text-field :disabled="uploading || !!createdPost" v-model="title" label="Título" />
      <v-textarea :disabled="uploading || !!createdPost" v-model="description" label="Descripción" />
      <v-file-input :disabled="uploading || !!createdPost"
        v-model="imageFile"
        label="Imagen (opcional)"
        accept="image/png, image/jpeg"
        prepend-icon="mdi-image"
      />
      <v-combobox :disabled="uploading || !!createdPost" v-model="tags" label="Etiquetas" multiple chips clearable />
      <v-btn color="primary" block :disabled="uploading || !!createdPost" :loading="uploading" @click="submit">Publicar</v-btn>
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
const submitError = ref('')
const createdPost = ref(null)
const authStore = useAuthStore()
const router = useRouter()

async function submit() {
  if (uploading.value || createdPost.value) return
  uploading.value = true
  submitError.value = ''
  try {
    let imageUrl = null
    if (imageFile.value) {
      const file = imageFile.value
      const path = `${authStore.user.id}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('post-images').upload(path, file)
      if (uploadError) {
        submitError.value = 'No se pudo subir la imagen. Tus datos siguen en el formulario; intenta de nuevo.'
        return
      }
      imageUrl = supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl
    }

    const { data: post, error } = await supabase.from('posts').insert({
      title: title.value,
      description: description.value,
      author_id: authStore.user.id,
      image_url: imageUrl,
    }).select().single()
    if (error) throw error
    if (!post) throw new Error('No se recibió la publicación guardada')
    createdPost.value = post

    for (const tagName of tags.value) {
      const lookup = await supabase.from('tags').select('id').eq('name', tagName).maybeSingle()
      if (lookup.error) throw lookup.error
      let tag = lookup.data
      if (!tag) {
        const result = await supabase.from('tags').insert({ name: tagName }).select().single()
        if (result.error) throw result.error
        tag = result.data
      }
      if (!tag) throw new Error('No se recibió la etiqueta guardada')
      const result = await supabase.from('post_tags').insert({ post_id: post.id, tag_id: tag.id })
      if (result.error) throw result.error
    }
    await router.push('/')
  } catch {
    submitError.value = createdPost.value
      ? 'La publicación ya se guardó, pero no se pudo completar la operación. Revisa tu perfil antes de volver a publicarla.'
      : 'No se pudo guardar la publicación. Tus datos siguen en el formulario; intenta de nuevo.'
  } finally {
    uploading.value = false
  }
}
</script>
