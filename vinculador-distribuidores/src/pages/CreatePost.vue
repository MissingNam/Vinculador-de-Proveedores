<template>
  <v-container max-width="600">
    <v-card class="pa-6">
      <v-card-title>{{ isOffer ? 'Nueva oferta' : 'Nueva publicación' }}</v-card-title>

      <v-form :disabled="uploading || published" @submit.prevent="submit">
        <v-text-field v-model="title" counter="160" label="Título" maxlength="160" />
        <v-textarea v-model="description" counter="5000" label="Descripción" maxlength="5000" />

        <template v-if="isOffer">
          <p class="text-body-2 mb-3">Clasifica lo que ofreces en esta publicación, aunque sea diferente al rubro de tu empresa.</p>
          <v-select v-model="nature" :items="NATURES" label="Naturaleza de la oferta" />

          <v-autocomplete
            v-model="sectorId"
            item-title="name"
            item-value="id"
            :items="sectors"
            label="Rubro de la oferta"
            :loading="catalogLoading"
          />

          <v-alert v-if="catalogError" class="mb-3" type="warning">{{ catalogError }} <v-btn variant="text" @click="loadSectors">Reintentar</v-btn></v-alert>
        </template>

        <v-file-input v-model="imageFile" accept="image/png,image/jpeg" label="Imagen (opcional, máximo 5 MB)" prepend-icon="mdi-image" />

        <v-combobox
          v-model="tags"
          chips
          clearable
          label="Etiquetas (máximo 10)"
          multiple
        />

        <v-alert v-if="error" class="mb-3" role="alert" type="error">{{ error }}</v-alert>
        <v-alert v-if="published" class="mb-3" type="success">La publicación se guardó. Puedes verla en Mi empresa.</v-alert>

        <v-btn
          block
          color="primary"
          :disabled="published"
          :loading="uploading"
          type="submit"
        >Publicar</v-btn>
      </v-form>
    </v-card>
  </v-container>
</template>

<script setup>
  import { computed, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { canClassify, listSectors, NATURES } from '@/lib/classification'
  import { createPost, validatePost } from '@/lib/offers'
  import { supabase } from '@/lib/supabase'
  import { useAuthStore } from '@/stores/auth'
  import { useRecommendationsStore } from '@/stores/recommendations'

  const title = ref(''), description = ref(''), tags = ref([]), imageFile = ref(null)
  const nature = ref(null), sectorId = ref(null), sectors = ref([])
  const published = ref(false)
  const uploading = ref(false), error = ref(''), catalogError = ref(''), catalogLoading = ref(false)
  const authStore = useAuthStore()
  const recommendations = useRecommendationsStore()
  const router = useRouter()
  const isOffer = computed(() => canClassify(authStore.profile?.role))
  async function loadSectors() {
    catalogLoading.value = true
    catalogError.value = ''
    try { sectors.value = (await listSectors(supabase)).filter(sector => sector.active) }
    catch { catalogError.value = 'No se pudieron cargar los rubros.' }
    finally { catalogLoading.value = false }
  }
  onMounted(loadSectors)

  async function submit() {
    if (uploading.value || published.value) return
    error.value = ''
    uploading.value = true
    let uploadedPath = null
    try {
      if (!authStore.user || authStore.isGuest) throw new Error('Inicia sesión para publicar.')
      const payload = validatePost({ title: title.value, description: description.value, tags: tags.value, nature: nature.value, sectorId: sectorId.value }, isOffer.value)
      const file = Array.isArray(imageFile.value) ? imageFile.value[0] : imageFile.value
      if (file) {
        if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Selecciona una imagen PNG o JPEG de hasta 5 MB.')
        const path = `${authStore.user.id}/${crypto.randomUUID()}.${file.type === 'image/png' ? 'png' : 'jpg'}`
        const { error: uploadError } = await supabase.storage.from('post-images').upload(path, file)
        if (uploadError) throw new Error('No se pudo subir la imagen. Intenta de nuevo.')
        uploadedPath = path
        payload.p_image_url = supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl
      }
      await createPost(supabase, payload)
      published.value = true
      recommendations.reset()
      await router.push('/perfil')
    } catch (error_) {
      error.value = error_.message || 'No se pudo publicar.'
      if (uploadedPath && !published.value && /^(?:22|23|42|PGRST)/.test(error_.code || '')) {
        try { await supabase.storage.from('post-images').remove([uploadedPath]) } catch { /* El post ya fue revertido; no ocultar el error original. */ }
      } else if (uploadedPath && !published.value) {
        error.value += ' Si hubo una interrupción de red, revisa Mi empresa antes de reintentar.'
      }
    } finally { uploading.value = false }
  }
</script>

