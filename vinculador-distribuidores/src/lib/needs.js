import { literalPattern, quotedFilter, searchParam } from './searchUtils.js'

export const NEEDS_PAGE_SIZE = 12
export function emptyNeed() {
  return {
    title: '', description: '', nature: 'bien', sector_id: null,
    country: '', region: '', city: '', budget_min: '', budget_max: '', currency: 'MXN',
    quantity: '', unit: '', delivery_date: '', service_mode: 'presencial', service_scope: '', start_date: '', end_date: '',
  }
}
const clean = value => typeof value === 'string' ? value.trim() : ''
const optionalDate = value => clean(value) || null
const numberValue = value => ['', null, undefined].includes(value) ? Number.NaN : Number(value)
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) > 0 && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
function validBudget(value) {
  const number = numberValue(value)
  return Number.isFinite(number) && number >= 0 && number <= 999_999_999_999.99 && /^\d+(?:\.\d{1,2})?$/.test(String(value))
}

export function validateNeed(form) {
  const errors = {}
  for (const [key, min, max, label] of [
    ['title', 5, 120, 'El título'], ['description', 10, 4000, 'La descripción'],
    ['country', 2, 80, 'El país'], ['region', 2, 100, 'El estado o región'], ['city', 2, 100, 'La ciudad'],
  ]) {
    const length = clean(form[key]).length
    if (length < min || length > max) {errors[key] = `${label} debe tener entre ${min} y ${max} caracteres.`}
  }
  if (!['bien', 'servicio'].includes(form.nature)) {errors.nature = 'Selecciona bienes o servicios.'}
  if (!clean(form.sector_id)) {errors.sector_id = 'Selecciona un rubro del catálogo.'}
  if (!['MXN', 'USD'].includes(form.currency)) {errors.currency = 'Selecciona MXN o USD.'}
  for (const key of ['budget_min', 'budget_max']) {
    if (!validBudget(form[key])) {
      errors[key] = 'Ingresa un monto válido, con hasta dos decimales.'
    }
  }
  if (!errors.budget_max && (numberValue(form.budget_max) <= 0 || numberValue(form.budget_max) < numberValue(form.budget_min))) {
    errors.budget_max = 'El máximo debe ser mayor que cero y al menos igual al mínimo.'
  }
  if (form.nature === 'bien') {
    const quantity = numberValue(form.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 99_999_999_999.999 || !/^\d+(?:\.\d{1,3})?$/.test(String(form.quantity))) {
      errors.quantity = 'Ingresa una cantidad mayor que cero, con hasta tres decimales.'
    }
    if (!clean(form.unit) || clean(form.unit).length > 40) {errors.unit = 'Indica la unidad (máximo 40 caracteres).'}
    if (form.delivery_date && !validDate(form.delivery_date)) {errors.delivery_date = 'Ingresa una fecha válida.'}
  } else if (form.nature === 'servicio') {
    if (!['presencial', 'remoto', 'hibrido'].includes(form.service_mode)) {errors.service_mode = 'Selecciona la modalidad.'}
    if (clean(form.service_scope).length < 10 || clean(form.service_scope).length > 2000) {errors.service_scope = 'Describe el alcance en 10 a 2000 caracteres.'}
    for (const key of ['start_date', 'end_date']) {
      if (form[key] && !validDate(form[key])) {errors[key] = 'Ingresa una fecha válida.'}
    }
    if (form.end_date && (!form.start_date || form.end_date < form.start_date)) {errors.end_date = 'El fin debe ser igual o posterior al inicio.'}
  }
  return errors
}

export function needPayload(form) {
  const errors = validateNeed(form)
  if (Object.keys(errors).length > 0) {throw Object.assign(new Error('Invalid need'), { fields: errors, userMessage: 'Revisa los campos del formulario.' })}
  const goods = form.nature === 'bien'
  return {
    title: clean(form.title), description: clean(form.description), nature: form.nature, sector_id: clean(form.sector_id),
    country: clean(form.country), region: clean(form.region), city: clean(form.city),
    budget_min: Number(form.budget_min), budget_max: Number(form.budget_max), currency: form.currency,
    quantity: goods ? Number(form.quantity) : null, unit: goods ? clean(form.unit) : null,
    delivery_date: goods ? optionalDate(form.delivery_date) : null,
    service_mode: goods ? null : form.service_mode, service_scope: goods ? null : clean(form.service_scope),
    start_date: goods ? null : optionalDate(form.start_date), end_date: goods ? null : optionalDate(form.end_date),
  }
}

const columns = '*, sectors(name), profiles!needs_owner_id_fkey(full_name)'

export async function listNeeds(client, { text = '', nature = '', sector = '', ownerId = '', status = '', page = 1, signal } = {}) {
  let query = client.from('needs').select(columns, { count: 'exact' })
  if (ownerId) {query = query.eq('owner_id', ownerId)}
  if (!ownerId) {query = query.eq('status', 'abierta')}
  else if (status) {query = query.eq('status', status)}
  if (nature) {query = query.eq('nature', nature)}
  if (sector) {query = query.eq('sector_id', sector)}
  const term = searchParam(text)
  if (term) {
    const quoted = quotedFilter(literalPattern(term))
    query = query.or(`title.imatch.${quoted},description.imatch.${quoted}`)
  }
  query = query.order('created_at', { ascending: false }).order('id', { ascending: false }).range((page - 1) * NEEDS_PAGE_SIZE, page * NEEDS_PAGE_SIZE - 1)
  if (signal) {query = query.abortSignal(signal)}
  const { data, count, error } = await query
  if (error) {throw error}
  return { needs: data ?? [], total: count ?? 0 }
}

export async function getNeed(client, id) {
  const { data, error } = await client.from('needs').select(columns).eq('id', id).maybeSingle()
  if (error) {throw error}
  return data
}

async function savedRow(query) {
  const { data, error } = await query.select('id, updated_at, status').maybeSingle()
  if (error) {throw error}
  if (!data) {throw Object.assign(new Error('Conflict'), { userMessage: 'La necesidad cambió, se cerró o ya no está disponible. Recarga antes de continuar.' })}
  return data
}

export async function saveNeed(client, ownerId, form, previous) {
  const payload = needPayload(form)
  return savedRow(previous
    ? client.from('needs').update(payload).eq('id', previous.id).eq('owner_id', ownerId).eq('status', 'abierta').eq('updated_at', previous.updated_at)
    : client.from('needs').insert({ ...payload, owner_id: ownerId }))
}

export function closeNeed(client, ownerId, previous) {
  return savedRow(client.from('needs').update({ status: 'cerrada' })
    .eq('id', previous.id).eq('owner_id', ownerId).eq('status', 'abierta').eq('updated_at', previous.updated_at))
}
