/**
 * router/index.js
 *
 * Manual routes for ./src/pages/*.vue
 */

// Composables
import { createRouter, createWebHistory } from 'vue-router'
import Login from '@/pages/Login.vue'
import Register from '@/pages/Register.vue'
import Profile from '@/pages/Profile.vue'
import Feed from '@/pages/Feed.vue'
import CreatePost from '@/pages/CreatePost.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: Feed,
      meta: { guestOk: true }
    },
    {
      path: '/login',
      component: Login,
    },
    {
      path: '/register',
      component: Register,
    },
    { path: '/asistente', name: 'assistant', component: () => import('@/pages/Assistant.vue') },
    {
      path: '/publicar',
      component: CreatePost,
    },
    {
      path: '/perfil',
      component: Profile,
    },
    {
      path: '/necesidades',
      name: 'needs',
      component: () => import('@/pages/Needs.vue'),
      meta: { guestOk: true }
    },
    {
      path: '/necesidades/nueva',
      name: 'need-new',
      component: () => import('@/pages/NeedEditor.vue'),
    },
    {
      path: '/necesidades/:id/editar',
      name: 'need-edit',
      component: () => import('@/pages/NeedEditor.vue'),
    },
    {
      path: '/necesidades/:id',
      name: 'need-detail',
      component: () => import('@/pages/NeedDetail.vue'),
      meta: { guestOk: true }
    },
    {
      path: '/perfiles',
      name: 'profile-search',
      component: () => import('@/pages/ProfileSearch.vue'),
      meta: { guestOk: true }
    },
    {
      path: '/feed',
      component: Feed,
      meta: { guestOk: true }
    },
    {
      path: '/usuario/:id', 
      name: 'user-profile', 
      component: () => import('@/pages/UserProfile.vue'),
      meta: { guestOk: true }
    },
    {
      path: '/completar-perfil',
      name: 'complete-profile',
      component: () => import('@/pages/CompleteProfile.vue'),
    },
  ],
})

import { useAuthStore } from '@/stores/auth'
import { routeAccess } from '@/lib/routeAccess'
router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (authStore.loading) await authStore.init()

  return routeAccess(authStore, to)
})

export default router
