import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    profile: null,
    loading: true,
    swapView: false,    
  }),

  getters: {                  
    // Rol de los posts que se muestran en el feed
    feedRole: (state) => {
      const myRole = state.profile?.role
      if (!myRole || myRole === 'socio') return ''
      const opposite = myRole === 'cliente' ? 'proveedor' : 'cliente'
      return state.swapView ? myRole : opposite
    },
    isGuest: (state) => state.user?.is_anonymous === true,
    // Sesión real (no invitado) sin perfil: primer ingreso con Google o registro a medias
    needsProfile: (state) => Boolean(state.user) && state.user.is_anonymous !== true && !state.profile,
  },
  actions: {
    async init() {
      const { data: { session } } = await supabase.auth.getSession()
      this.user = session?.user ?? null
      if (this.user) await this.fetchProfile()
      this.loading = false

      supabase.auth.onAuthStateChange(async (_event, session) => {
        this.user = session?.user ?? null
        this.profile = this.user ? await this.fetchProfile() : null
      })
    },
    async fetchProfile() {
      if (this.user?.is_anonymous) { this.profile = null; return null }
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', this.user.id)
        .maybeSingle()
      this.profile = data
      return data
    },
    async signUp(email, password, fullName, role) {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: data.user.id, full_name: fullName, role })
      if (profileError) throw profileError
      this.user = data.user
      await this.fetchProfile()
    },
    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      this.user = data.user
      await this.fetchProfile()
    },
    async signOut() {
      await supabase.auth.signOut()
      this.user = null
      this.profile = null
      this.swapView = false  
    },
    async enterAsGuest() {
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) throw error
      this.user = data.user
      this.profile = null
    },
    async signInWithGoogle() {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: { prompt: 'select_account' },   // siempre deja elegir cuenta
        },
      })
      if (error) throw error
    },

    async completeProfile(fullName, role) {
      const metadata = this.user.user_metadata ?? {}
      const { error } = await supabase.from('profiles').insert({
        id: this.user.id,
        full_name: fullName,
        role,
        avatar_url: metadata.avatar_url || metadata.picture || null,
      })
      // 23505 = el perfil ya existía (por ejemplo, se creó desde otra pestaña): se continúa con ese
      if (error && error.code !== '23505') throw error
      await this.fetchProfile()
},
  },
})