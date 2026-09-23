<template>
  <v-container max-width="700">
    <v-card class="pa-6 mb-6">
      <div class="d-flex align-center">
        <v-avatar
          size="64"
          color="primary"
          class="mr-4"
          style="cursor: pointer"
          @click="openAvatarDialog"
        >
          <v-img v-if="authStore.profile?.avatar_url" :src="authStore.profile.avatar_url" />
          <v-icon v-else size="36">mdi-account</v-icon>
        </v-avatar>
        <div>
          <div class="text-h5">{{ authStore.profile?.full_name }}</div>
          <v-chip size="small" :color="authStore.profile?.role === 'proveedor' ? 'blue' : 'green'">
            {{ authStore.profile?.role }}
          </v-chip>
        </div>
      </div>

      <div class="mt-4">
        <div class="d-flex align-center justify-space-between">
          <span class="text-medium-emphasis text-caption">BIO</span>
          <v-btn size="small" variant="text" icon="mdi-pencil" @click="openBioDialog" />
        </div>
        <p v-if="authStore.profile?.bio">{{ authStore.profile.bio }}</p>
        <p v-else class="text-medium-emphasis">Sin biografía todavía.</p>
      </div>
    </v-card>

    <div class="text-h6 mb-3">Mis publicaciones</div>

    <v-progress-circular v-if="loading" indeterminate class="d-block mx-auto" />
    <p v-else-if="myPosts.length === 0" class="text-medium-emphasis">
      Aún no tienes publicaciones.
    </p>
    <PostCard
      v-for="post in myPosts"
      :key="post.id"
      :post="post"
      readonly
      @deleted="removePost"
    />

    <!-- Dialog compartido para editar avatar o bio -->
    <v-dialog v-model="showEditDialog" max-width="440">
      <v-card class="pa-4">
        <v-card-title>
          {{ editMode === 'avatar' ? 'Cambiar foto de perfil' : 'Editar biografía' }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-if="editMode === 'avatar'"
            v-model="avatarUrlInput"
            label="URL de imagen (.png o .jpg)"
            placeholder="https://images.pexels.com/..."
            clearable
          />
          <v-textarea
            v-else
            v-model="bioInput"
            label="Cuéntanos sobre ti"
            rows="4"
          />
          <v-alert v-if="errorMsg" type="error" density="compact" class="mt-2">
            {{ errorMsg }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showEditDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveEdit">Guardar</v-btn>
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

const authStore = useAuthStore()
const myPosts = ref([])
const loading = ref(true)

// --- edición de perfil ---
const showEditDialog = ref(false)
const editMode = ref('avatar') // 'avatar' o 'bio'
const avatarUrlInput = ref('')
const bioInput = ref('')
const saving = ref(false)
const errorMsg = ref('')

function openAvatarDialog() {
  editMode.value = 'avatar'
  avatarUrlInput.value = authStore.profile?.avatar_url ?? ''
  errorMsg.value = ''
  showEditDialog.value = true
}

function openBioDialog() {
  editMode.value = 'bio'
  bioInput.value = authStore.profile?.bio ?? ''
  errorMsg.value = ''
  showEditDialog.value = true
}

function isValidImageUrl(url) {
  return /^https?:\/\/.+\.(png|jpg|jpeg)$/i.test(url.trim())
}

async function saveEdit() {
  errorMsg.value = ''
  const updates = {}

  if (editMode.value === 'avatar') {
    if (avatarUrlInput.value && !isValidImageUrl(avatarUrlInput.value)) {
      errorMsg.value = 'La URL debe terminar en .png, .jpg o .jpeg'
      return
    }
    updates.avatar_url = avatarUrlInput.value || null
  } else {
    updates.bio = bioInput.value
  }

  saving.value = true
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', authStore.user.id)
  saving.value = false

  if (error) {
    errorMsg.value = error.message
    return
  }
  await authStore.fetchProfile()
  showEditDialog.value = false
}

function removePost(id) {
  myPosts.value = myPosts.value.filter(p => p.id !== id)
}

onMounted(async () => {
  const { data } = await supabase
    .from('posts')
    .select('*, profiles(full_name), post_tags(tags(id, name))')
    .eq('author_id', authStore.user.id)
    .order('created_at', { ascending: false })
  myPosts.value = data ?? []
  loading.value = false
})
</script>