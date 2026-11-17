/* eslint-disable unicorn/no-this-outside-of-class -- Pinia Options Store expone el estado mediante this. */
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'

const initializations = new WeakMap()
const subscriptions = new WeakMap()

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
      if (!myRole || myRole === 'socio') {return ''}
      const opposite = myRole === 'cliente' ? 'proveedor' : 'cliente'
      return state.swapView ? myRole : opposite
    },
    isGuest: (state) => state.user?.is_anonymous === true,
    // Sesión real (no invitado) sin perfil: primer ingreso con Google o registro a medias
    needsProfile: (state) => Boolean(state.user) && state.user.is_anonymous !== true && !state.profile,
  },
  actions: {
    async init() {
      if (initializations.has(this)) {return initializations.get(this)}
      if (!this.loading && subscriptions.has(this)) {return}
      const pending = (async () => {
        try {
          const { data: { session }, error } = await supabase.auth.getSession()
          if (error) {throw error}
          this.user = session?.user ?? null
          if (this.user) {await this.fetchProfile()}
          if (!subscriptions.has(this)) {
            const listener = supabase.auth.onAuthStateChange((_event, nextSession) => {
              const changedUser = this.user?.id !== nextSession?.user?.id
              this.user = nextSession?.user ?? null
              if (changedUser || !this.user || this.isGuest) {this.profile = null}
              // No esperar otra llamada de Supabase dentro del bloqueo de Auth.
              if (this.user && !this.isGuest) {setTimeout(() => { this.fetchProfile().catch(() => {}) }, 0)}
            })
            subscriptions.set(this, listener.data.subscription)
          }
        } finally { this.loading = false }
      })()
      initializations.set(this, pending)
      try { await pending }
      finally { initializations.delete(this) }
    },
    async fetchProfile() {
      if (this.user?.is_anonymous) { this.profile = null; return null }
      const userId = this.user?.id
      if (!userId) {return null}
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (error) {throw error}
      if (this.user?.id === userId) {this.profile = data}
      return data
    },
    async signUp(email, password, fullName, role) {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {throw error}
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: data.user.id, full_name: fullName, role })
      if (profileError) {throw profileError}
      this.user = data.user
      await this.fetchProfile()
    },
    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {throw error}
      this.user = data.user
      await this.fetchProfile()
    },
    async signOut() {
      const { error } = await supabase.auth.signOut()
      if (error) {throw error}
      this.user = null
      this.profile = null
      this.swapView = false  
    },
    async enterAsGuest() {
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) {throw error}
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
      if (error) {throw error}
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
      if (error && error.code !== '23505') {throw error}
      await this.fetchProfile()
},
  },
})