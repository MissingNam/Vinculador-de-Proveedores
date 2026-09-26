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
    },
    {
      path: '/login',
      component: Login,
    },
    {
      path: '/register',
      component: Register,
    },
    {
      path: '/publicar',
      component: CreatePost,
    },
    {
      path: '/perfil',
      component: Profile,
    },
    {
      path: '/feed',
      component: Feed,
    },
    {
      path: '/usuario/:id', 
      name: 'user-profile', 
      component: () => import('@/pages/UserProfile.vue')
    },
  ],
})

import { useAuthStore } from '@/stores/auth'
router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (authStore.loading) await authStore.init()

  const publicPages = ['/login', '/register']
  if (!authStore.user && !publicPages.includes(to.path)) return '/login'
  if (authStore.user && publicPages.includes(to.path)) return '/'
})

export default router
