/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Composables
import { createApp } from 'vue'

// Plugins
import { registerPlugins } from '@/plugins'

// Pinia
import { createPinia } from 'pinia'

// Components
import App from './App.vue'

// Styles
import 'unfonts.css'

const app = createApp(App)
app.use(createPinia())

registerPlugins(app)

app.mount('#app')


