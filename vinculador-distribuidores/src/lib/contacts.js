export const CONTACT_KINDS = [
  { title: 'Teléfono', value: 'telefono', icon: 'mdi-phone-outline', placeholder: '+52 686 123 4567' },
  { title: 'Correo', value: 'correo', icon: 'mdi-email-outline', placeholder: 'contacto@empresa.com' },
  { title: 'Otro (WhatsApp, Telegram…)', value: 'otro', icon: 'mdi-message-text-outline', placeholder: 'Usuario, número o enlace' },
]

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const clean = value => String(value ?? '').trim()
const stripPhone = value => clean(value).replace(/[\s().-]/g, '')

export function contactIcon(kind) {
  return CONTACT_KINDS.find(k => k.value === kind)?.icon ?? 'mdi-message-text-outline'
}

// Devuelve un mensaje de error, o '' si el dato es válido
export function contactProblem(kind, label, value) {
  const text = clean(value)
  if (text.length < 3) return 'Escribe el dato de contacto'
  if (text.length > 200) return 'El dato es demasiado largo (máximo 200 caracteres)'
  if (clean(label).length > 60) return 'El nombre es demasiado largo (máximo 60 caracteres)'
  if (kind === 'correo' && !EMAIL.test(text)) return 'Ingresa un correo válido (ej. contacto@empresa.com)'
  if (kind === 'telefono' && !/^\+?\d{7,15}$/.test(stripPhone(text))) return 'Ingresa un teléfono válido (de 7 a 15 dígitos, con o sin +)'
  if (kind === 'otro' && !clean(label)) return 'Indica el nombre del medio (ej. WhatsApp)'
  return ''
}

// Solo se generan enlaces mailto:, tel: y http(s): nunca javascript: ni otros esquemas
export function contactHref(kind, value) {
  const text = clean(value)
  if (kind === 'correo') return `mailto:${text}`
  if (kind === 'telefono') return `tel:${stripPhone(text)}`
  try {
    const url = new URL(text)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}