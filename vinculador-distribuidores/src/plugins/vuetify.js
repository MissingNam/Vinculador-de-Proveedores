import { createVuetify } from 'vuetify'
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

// Única fuente de verdad de la marca. Ningún componente usa hex.
const PRIMARY = '#164E63' // azul petróleo

const sunFinder = {
  dark: false,
  colors: {
    primary: PRIMARY,
    secondary: '#0F766E',        // verde azulado: oportunidades / interés
    background: '#F5F7FA',
    surface: '#FFFFFF',
    'on-background': '#1F2937',  // texto principal
    'on-surface': '#1F2937',
    muted: '#64748B',            // texto secundario → clase .text-muted
    success: '#15803D',
    warning: '#B45309',
    error: '#B91C1C',
    info: PRIMARY,
  },
  variables: {
    'border-color': '#E2E8F0',
    'border-opacity': 1,
    'high-emphasis-opacity': 1,  // el texto principal se ve exactamente #1F2937
  },
}

const field = { variant: 'outlined', density: 'comfortable', color: 'primary' }

export default createVuetify({
  theme: {
    defaultTheme: 'sunFinder',   // tema claro fijo (se acabó 'system')
    themes: { sunFinder },
  },
  defaults: {
    VBtn: { color: 'primary', variant: 'flat' },   // principal: fondo primario, texto blanco
    VCard: { border: true, elevation: 0 },
    VAppBar: { color: 'surface', flat: true, border: 'b' },
    VAlert: { variant: 'tonal' },
    VTooltip: { contentClass: 'app-tooltip' },
    VTextField: field,
    VTextarea: field,
    VSelect: field,
    VCombobox: field,
    VFileInput: field,
    VSwitch: { color: 'primary' },
    VRadio: { color: 'primary' },
  },
})