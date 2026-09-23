import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    profile: null,
    loading: true,
  }),
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
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', this.user.id)
        .single()
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
    },
  },
})