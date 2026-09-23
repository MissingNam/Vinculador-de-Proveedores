import router from '../router';
/**
 * plugins/index.ts
 *
 * Automatically included in `./src/main.ts`
 */

// Types

// Plugins
import vuetify from './vuetify'

export function registerPlugins (app) {
 app.use(vuetify)
 app.use(router);
}