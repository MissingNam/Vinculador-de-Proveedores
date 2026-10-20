<template>
  <v-container max-width="700">
    <v-card class="pa-6 mb-6">
      <div class="d-flex align-center">
        <v-avatar size="64" color="primary" class="mr-4" style="cursor: pointer" @click="openAvatarDialog">
          <v-img v-if="authStore.profile?.avatar_url" :src="authStore.profile.avatar_url" />
          <v-icon v-else size="36">mdi-account</v-icon>
        </v-avatar>
        <div>
          <div class="text-h5">{{ authStore.profile?.full_name }}</div>
            <v-chip size="small" :color="ROLE_COLORS[authStore.profile?.role]">
              {{ ROLE_LABELS[authStore.profile?.role] }}
            </v-chip>
        </div>
      </div>

      <!-- Bio -->
      <div class="mt-4">
        <div class="d-flex align-center justify-space-between">
          <span class="text-medium-emphasis text-caption">BIO</span>
          <v-btn size="small" variant="text" icon="mdi-pencil" @click="openBioDialog" />
        </div>
        <p v-if="authStore.profile?.bio">{{ authStore.profile.bio }}</p>
        <p v-else class="text-medium-emphasis">Sin biografía todavía.</p>
      </div>

      <!-- Tags -->
      <div class="mt-4">
        <div class="d-flex align-center justify-space-between">
          <span class="text-medium-emphasis text-caption">ETIQUETAS</span>
          <v-btn size="small" variant="text" icon="mdi-pencil" @click="openTagsDialog" />
        </div>
        <div v-if="myTags.length">
          <v-chip
            v-for="t in myTags"
            :key="t.id"
            :aria-label="`Buscar perfiles con la etiqueta ${t.name}`"
            class="mr-1 mb-1"
            size="small"
            :to="{ path: '/perfiles', query: { tag: t.name } }"
          >{{ t.name }}</v-chip>
        </div>
        <p v-else class="text-medium-emphasis">Sin etiquetas todavía.</p>
      </div>

      <!-- Links -->
      <div class="mt-4">
        <div class="d-flex align-center justify-space-between">
          <span class="text-medium-emphasis text-caption">ENLACES</span>
          <v-btn size="small" variant="text" icon="mdi-pencil" @click="openLinksDialog" />
        </div>
        <div v-if="myLinks.length">
          <div v-for="link in myLinks" :key="link.id">
            <a :href="link.url" target="_blank" rel="noopener noreferrer">
              {{ link.label || link.url }}
            </a>
          </div>
        </div>
        <p v-else class="text-medium-emphasis">Sin enlaces todavía.</p>
      </div>
    </v-card>

    <div class="text-h6 mb-3">Mis publicaciones</div>
    <v-progress-circular v-if="loading" indeterminate class="d-block mx-auto" />
    <p v-else-if="myPosts.length === 0" class="text-medium-emphasis">Aún no tienes publicaciones.</p>
    <PostCard v-for="post in myPosts" :key="post.id" :post="post" readonly @deleted="removePost" />

    <!-- Dialog compartido -->
    <v-dialog v-model="showEditDialog" max-width="480">
      <v-card class="pa-4">
        <v-card-title>
          <span v-if="editMode === 'avatar'">Cambiar foto de perfil</span>
          <span v-else-if="editMode === 'bio'">Editar biografía</span>
          <span v-else-if="editMode === 'tags'">Editar etiquetas</span>
          <span v-else>Editar enlaces</span>
        </v-card-title>
        <v-card-text>
          <v-file-input
            v-if="editMode === 'avatar'"
            v-model="avatarFile"
            label="Selecciona una imagen"
            accept="image/png, image/jpeg"
            prepend-icon="mdi-camera"
          />
          <v-textarea
            v-else-if="editMode === 'bio'"
            v-model="bioInput"
            label="Cuéntanos sobre ti"
            rows="4"
          />
          <v-combobox
            v-else-if="editMode === 'tags'"
            v-model="tagsInput"
            label="Etiquetas"
            multiple
            chips
            clearable
          />
          <div v-else>
            <!-- editMode === 'links' -->
            <div v-for="link in myLinks" :key="link.id" class="d-flex align-center mb-2">
              <span class="flex-grow-1">{{ link.label || link.url }}</span>
              <v-btn icon="mdi-close" size="small" variant="text" @click="removeLink(link.id)" />
            </div>
            <v-divider class="my-3" v-if="myLinks.length" />
            <v-text-field v-model="linkLabelInput" label="Nombre (opcional)" placeholder="Sitio web de mi empresa" />
            <v-text-field v-model="linkUrlInput" label="URL" placeholder="https://miempresa.com" />
            <v-btn color="primary" variant="tonal" :loading="saving" @click="addLink">Añadir enlace</v-btn>
          </div>

          <v-alert v-if="errorMsg" type="error" density="compact" class="mt-2">{{ errorMsg }}</v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showEditDialog = false">
            {{ editMode === 'links' ? 'Cerrar' : 'Cancelar' }}
          </v-btn>
          <v-btn v-if="editMode !== 'links'" color="primary" :loading="saving" @click="saveEdit">
            Guardar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>


<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import PostCard from '@/components/PostCard.vue'
import { ROLE_COLORS, ROLE_LABELS } from '@/lib/roles'

const authStore = useAuthStore()
const myPosts = ref([])
const myTags = ref([])       // [{id, name}]
const myLinks = ref([])      // [{id, label, url}]
const loading = ref(true)

const showEditDialog = ref(false)
const editMode = ref('avatar')
const avatarFile = ref(null)
const bioInput = ref('')
const tagsInput = ref([])     // array de strings para v-combobox
const linkLabelInput = ref('')
const linkUrlInput = ref('')
const saving = ref(false)
const errorMsg = ref('')

function openAvatarDialog() {
  editMode.value = 'avatar'
  avatarFile.value = null
  errorMsg.value = ''
  showEditDialog.value = true
}

function openBioDialog() {
  editMode.value = 'bio'
  bioInput.value = authStore.profile?.bio ?? ''
  errorMsg.value = ''
  showEditDialog.value = true
}

function openTagsDialog() {
  editMode.value = 'tags'
  tagsInput.value = myTags.value.map(t => t.name)
  errorMsg.value = ''
  showEditDialog.value = true
}

function openLinksDialog() {
  editMode.value = 'links'
  linkLabelInput.value = ''
  linkUrlInput.value = ''
  errorMsg.value = ''
  showEditDialog.value = true
}

function isValidUrl(url) {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

async function fetchTagsAndLinks() {
  const { data: tagsData } = await supabase
    .from('profile_tags')
    .select('tags(id, name)')
    .eq('profile_id', authStore.user.id)
  myTags.value = (tagsData ?? []).map(row => row.tags).filter(Boolean)

  const { data: linksData } = await supabase
    .from('profile_links')
    .select('*')
    .eq('profile_id', authStore.user.id)
    .order('created_at', { ascending: true })
  myLinks.value = linksData ?? []
}

async function saveEdit() {
  errorMsg.value = ''

  if (editMode.value === 'avatar') {
    if (!avatarFile.value) {
      errorMsg.value = 'Selecciona una imagen'
      return
    }
    saving.value = true

    const file = avatarFile.value
    const path = `${authStore.user.id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file)

    if (uploadError) {
      saving.value = false
      errorMsg.value = uploadError.message
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: data.publicUrl })
      .eq('id', authStore.user.id)

    saving.value = false
    if (error) { errorMsg.value = error.message; return }
    await authStore.fetchProfile()
    showEditDialog.value = false
    return
  } 

  if (editMode.value === 'bio') {
    saving.value = true
    const { error } = await supabase
      .from('profiles')
      .update({ bio: bioInput.value })
      .eq('id', authStore.user.id)
    saving.value = false
    if (error) { errorMsg.value = error.message; return }
    await authStore.fetchProfile()
    showEditDialog.value = false
    return
  }

  if (editMode.value === 'tags') {
    saving.value = true
    // Borra las relaciones actuales y reconstruye (más simple que hacer diff)
    await supabase.from('profile_tags').delete().eq('profile_id', authStore.user.id)

    for (const tagName of tagsInput.value) {
      let { data: tag } = await supabase.from('tags').select('id').eq('name', tagName).single()
      if (!tag) {
        const { data: newTag } = await supabase.from('tags').insert({ name: tagName }).select().single()
        tag = newTag
      }
      await supabase.from('profile_tags').insert({ profile_id: authStore.user.id, tag_id: tag.id })
    }
    saving.value = false
    await fetchTagsAndLinks()
    showEditDialog.value = false
    return
  }
  // 'links' se guarda con addLink(), no aquí (ver abajo)
}

async function addLink() {
  errorMsg.value = ''
  if (!linkUrlInput.value || !isValidUrl(linkUrlInput.value)) {
    errorMsg.value = 'Ingresa una URL válida (ej. https://miempresa.com)'
    return
  }
  saving.value = true
  const { error } = await supabase.from('profile_links').insert({
    profile_id: authStore.user.id,
    label: linkLabelInput.value || null,
    url: linkUrlInput.value,
  })
  saving.value = false
  if (error) { errorMsg.value = error.message; return }
  linkLabelInput.value = ''
  linkUrlInput.value = ''
  await fetchTagsAndLinks()
}

async function removeLink(id) {
  await supabase.from('profile_links').delete().eq('id', id)
  await fetchTagsAndLinks()
}

function removePost(id) {
  myPosts.value = myPosts.value.filter(p => p.id !== id)
}

onMounted(async () => {
  const { data } = await supabase
    .from('posts')
    .select('*, profiles(full_name, role), post_tags(tags(id, name))')
    .eq('author_id', authStore.user.id)
    .order('created_at', { ascending: false })
  myPosts.value = data ?? []
  await fetchTagsAndLinks()
  loading.value = false
})
</script>
