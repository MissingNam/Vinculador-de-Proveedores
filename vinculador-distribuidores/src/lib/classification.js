export const NATURES = [
  { title: 'Bienes', value: 'bien' },
  { title: 'Servicios', value: 'servicio' },
]
export const PROVIDER_NATURES = [...NATURES, { title: 'Bienes y servicios', value: 'ambos' }]
export const SERVICE_MODES = [
  { title: 'Presencial', value: 'presencial' },
  { title: 'Remoto', value: 'remoto' },
  { title: 'Híbrido', value: 'hibrido' },
]
export const natureLabel = value => PROVIDER_NATURES.find(item => item.value === value)?.title || 'Sin clasificar'
export const canClassify = role => ['proveedor', 'socio'].includes(role)

export function featureError(error, fallback = 'No se pudo completar la operación. Intenta de nuevo.') {
  if (['42P01', '42703', 'PGRST200', 'PGRST204', 'PGRST205'].includes(error?.code)) {
    return 'Esta función todavía no está habilitada. Solicita al equipo que active la clasificación y las necesidades.'
  }
  if (error?.code === '42501') {return 'Tu cuenta no tiene permiso para realizar esta operación.'}
  return error?.userMessage || fallback
}

export async function listSectors(client) {
  const { data, error } = await client.from('sectors').select('id, name, active').order('sort_order').order('name')
  if (error) {throw error}
  return data ?? []
}

export async function getClassification(client, profileId) {
  const { data, error } = await client.from('provider_classifications')
    .select('profile_id, nature, sector_id, updated_at, sectors(name)')
    .eq('profile_id', profileId)
.maybeSingle()
  if (error) {throw error}
  return data
}

export async function saveClassification(client, profileId, value, previous) {
  if (!PROVIDER_NATURES.some(item => item.value === value.nature) || !value.sector_id) {
    throw Object.assign(new Error('Invalid classification'), { userMessage: 'Selecciona la naturaleza y el rubro.' })
  }
  const payload = { nature: value.nature, sector_id: value.sector_id }
  const query = previous
    ? client.from('provider_classifications').update(payload).eq('profile_id', profileId).eq('updated_at', previous.updated_at)
    : client.from('provider_classifications').insert({ ...payload, profile_id: profileId })
  const { data, error } = await query.select('profile_id, nature, sector_id, updated_at, sectors(name)').maybeSingle()
  if (error) {
    if (error.code === '23505') {error.userMessage = 'La clasificación cambió en otra ventana. Cierra el formulario y recarga antes de editar.'}
    throw error
  }
  if (!data) {throw Object.assign(new Error('Conflict'), { userMessage: 'La clasificación cambió en otra ventana. Cierra el formulario y recarga antes de editar.' })}
  return data
}
