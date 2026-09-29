# vinculador-distribuidores

Scaffolded with Vuetify CLI.

## Configuración local de Supabase

Ejecuta los comandos desde la carpeta `vinculador-distribuidores`.

1. Instala las dependencias con `pnpm install --frozen-lockfile`.
2. Copia `.env.example` a `.env` y completa `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_PUBLISHABLE_KEY` con la configuración de desarrollo del equipo.
   Usa únicamente la clave publicable; nunca una clave secreta o `service_role`.
3. Inicia el servidor con `pnpm dev` y abre la dirección que muestre la terminal
   (normalmente `http://localhost:3000`).
4. Inicia sesión con una cuenta de prueba del proyecto.

Reinicia el servidor después de cambiar `.env`. Este archivo queda excluido
de Git. La aplicación necesita una configuración válida de Supabase para iniciar;
que `pnpm build` termine correctamente no comprueba la conexión a la base de datos.

Para verificar el proyecto, ejecuta `pnpm build` y `pnpm lint`. La segunda orden
revisa el estilo del código sin modificarlo.

## Búsqueda de publicaciones

- Escribe en la barra y presiona Enter o la lupa. Se busca una coincidencia parcial
  del texto completo en el título, la descripción o el nombre de una etiqueta,
  sin distinguir mayúsculas de minúsculas. Los acentos sí se distinguen y los
  caracteres especiales se buscan literalmente.
- Selecciona una etiqueta de una publicación para filtrar por su nombre exacto.
  El filtro se combina con el texto de búsqueda que esté activo en el listado.
- Quita cada filtro con su botón de cierre o usa «Limpiar filtros» para volver al
  listado. La búsqueda queda en la URL y se conserva al recargar o usar Atrás.
- Las consultas se filtran en Supabase y los resultados se muestran en páginas
  de 20 publicaciones, ordenadas de más recientes a más antiguas.
- El buscador también permite volver al listado desde un perfil. Las etiquetas
  del perfil no forman parte de este filtro; se usan las etiquetas de los posts.

Para una comprobación manual, prueba coincidencias solo en la descripción o en
una etiqueta, texto y etiqueta combinados, búsquedas sin resultados, limpiar los
filtros y recargar la página. No hace falta modificar las tablas de Supabase.

## ❗️ Documentation

- Primary docs: https://vuetifyjs.com/
- Getting started guide: https://vuetifyjs.com/en/getting-started/installation/
- Community support: https://community.vuetifyjs.com/
- Issue tracker: https://issues.vuetifyjs.com/

## 🧱 Stack

- Framework: Vue 3 + Vite
- UI Library: Vuetify
- Language: JavaScript
- Package manager: pnpm

## 🧭 Start Here

- Main entry: `src/main.js`
- Main app component: `src/App.vue`
- Main styles: `src/styles/`
- Plugin setup: `src/plugins/`

## 📁 Project Structure

- `src/main.js` — application entry point
- `src/App.vue` — root component
- `src/components/` — reusable Vue components
- `src/plugins/` — plugin registration and setup
- `src/styles/` — global styles and theme settings
- `public/` — static public files

## ✨ Enabled Features

- ESLint
- Vuetify MCP
- Vue Router

## 💿 Install

Use your selected package manager (pnpm) to install dependencies:

```bash
pnpm install
```

## 🚀 Quick Start

```bash
pnpm install
pnpm dev
```

## 🏗️ Build

```bash
pnpm build
```

## 🧪 Available Scripts

- `pnpm dev`
- `pnpm build`
- `pnpm preview`
- `pnpm lint`
- `pnpm lint:fix`

## 🤖 Vuetify MCP Server

This project is configured with the Vuetify Model Context Protocol (MCP) server.
To install and configure the MCP server for your favorite IDE (Cursor, Trae, Windsurf, VS Code, Claude Desktop, etc.) run:

```bash
pnpm dlx @vuetify/mcp-cli
```

This will open an interactive setup wizard to help you connect your AI assistant to the Vuetify ecosystem.

## 💪 Support Vuetify Development

This project uses Vuetify - an MIT licensed Open Source project. We are glad to welcome contributors and any support for ongoing development:

- Contribute to Vuetify and ecosystem projects: https://github.com/vuetifyjs
- Request enterprise support: https://support.vuetifyjs.com/
- Sponsor on GitHub: https://github.com/sponsors/vuetifyjs
- Support on Open Collective: https://opencollective.com/vuetify
