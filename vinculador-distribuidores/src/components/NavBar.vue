<template>
  <v-app-bar>
    <RouterLink aria-label="Sun Finder, ir a Recomendaciones" class="brand" to="/">
      <v-avatar color="primary" rounded="lg" size="36" variant="tonal">
        <v-icon icon="mdi-white-balance-sunny" />
      </v-avatar>
      <span>Sun Finder</span>
    </RouterLink>

    <!-- Escritorio: opciones con texto -->
    <nav v-if="mdAndUp" aria-label="Navegación principal" class="main-nav">
      <v-btn
        v-for="item in items"
        :key="item.to"
        :aria-current="item === activeItem ? 'page' : undefined"
        :color="item === activeItem ? 'primary' : 'on-surface'"
        :to="item.to"
        :variant="item === activeItem ? 'tonal' : 'text'"
      >
        {{ item.label }}
      </v-btn>
    </nav>

    <v-spacer />

    <!-- Menú de cuenta: aquí vive "Cerrar sesión" -->
    <v-menu>
      <template #activator="{ props: menuProps }">
        <v-btn v-bind="menuProps" aria-label="Menú de cuenta" class="account" icon variant="text">
          <v-avatar color="primary" size="36" variant="tonal">
            <v-img
              v-if="authStore.profile?.avatar_url"
              alt=""
              cover
              :src="authStore.profile.avatar_url"
            />
            <span v-else class="text-body-2 font-weight-bold">{{ userInitials }}</span>
          </v-avatar>
        </v-btn>
      </template>

      <v-list min-width="220">
        <v-list-item :subtitle="roleLabel" :title="authStore.profile?.full_name || 'Mi cuenta'" />
        <v-divider />
        <v-list-item prepend-icon="mdi-logout" title="Cerrar sesión" @click="logout" />
      </v-list>
    </v-menu>
  </v-app-bar>

  <!-- Celular: navegación inferior. Vuetify reserva el espacio en v-main automáticamente. -->
  <v-bottom-navigation
    v-if="!mdAndUp"
    v-model="bottomValue"
    aria-label="Navegación principal"
    class="bottom-nav"
    color="primary"
    grow
    :mandatory="false"
    tag="nav"
  >
    <v-btn v-for="item in items" :key="item.to" :to="item.to" :value="item.to">
      <v-icon :icon="item.icon" />
      <span>{{ item.label }}</span>
    </v-btn>
  </v-bottom-navigation>
</template>

<script setup>
  import { computed } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { initials } from '@/lib/initials'
  import { ROLE_LABELS } from '@/lib/roles'
  import { useAuthStore } from '@/stores/auth'

  const router = useRouter()
  const route = useRoute()
  const authStore = useAuthStore()
  const { mdAndUp } = useDisplay()

  const items = [
    { label: 'Recomendaciones', icon: 'mdi-compass-outline', to: '/', match: p => p === '/' || p === '/feed' },
    { label: 'Buscar empresas', icon: 'mdi-domain', to: '/perfiles', match: p => p === '/perfiles' || p.startsWith('/usuario/') },
    { label: 'Necesidades', icon: 'mdi-clipboard-text-outline', to: '/necesidades', match: p => p.startsWith('/necesidades') },
    { label: 'Publicar', icon: 'mdi-plus-circle-outline', to: '/publicar', match: p => p === '/publicar' },
    { label: 'Mi empresa', icon: 'mdi-office-building-outline', to: '/perfil', match: p => p === '/perfil' },
  ]

  const activeItem = computed(() => items.find(item => item.match(route.path)))
  const bottomValue = computed({
    get: () => activeItem.value?.to ?? null,
    set: () => {},   // la ruta manda; el router cambia la sección
  })

  const userInitials = computed(() => initials(authStore.profile?.full_name))
  const roleLabel = computed(() => ROLE_LABELS[authStore.profile?.role] ?? '')

  async function logout() {
    await authStore.signOut()
    router.push('/login')
  }
</script>

<style scoped>
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-inline: 16px 24px;
    color: rgb(var(--v-theme-primary));
    font-size: 1.25rem;
    font-weight: 700;
    text-decoration: none;
  }

  .main-nav {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .account {
    margin-inline-end: 8px;
  }

  .bottom-nav :deep(.v-btn) {
    border-radius: 0;   /* anula el radio de 10px de los botones normales */
  }
</style>
