export const WINDOW_SIZE = 9   // posts en la ventana
export const BUFFER = 4        // posts a cada lado del actual

const POST_COLUMNS = '*, affinity, profiles(full_name, role), post_tags(tags(id, name, user_tag_scores(score)))'


export async function fetchRecommendations(client, { limit = WINDOW_SIZE, excludeIds = [], roles = null, nature = null, sectorId = null, signal } = {}) {
  let query = client
    .rpc('recommend_posts', { p_limit: limit, p_exclude: excludeIds, p_roles: roles, p_nature: nature || null, p_sector_id: sectorId || null })
    .select('*')
  if (signal) {query = query.abortSignal(signal)}

  let { data, error } = await query
  // Durante el despliegue, el feed anterior sigue disponible sin filtros.
  // Nunca devolver resultados sin filtrar cuando el usuario eligió un filtro.
  if (error?.code === 'PGRST202' && !nature && !sectorId && !signal?.aborted) {
    let legacy = client.rpc('recommend_posts', { p_limit: limit, p_exclude: excludeIds, p_roles: roles }).select(POST_COLUMNS)
    if (signal) {legacy = legacy.abortSignal(signal)}
    const result = await legacy
    data = result.data
    error = result.error
  }
  if (error?.code === 'PGRST202') {
    error.userMessage = 'Los filtros de recomendaciones todavía no están habilitados. Solicita al equipo que active esta función.'
  }
  if (error) {throw error}
  return data ?? []
}

export function recommendationReasons(post) {
  const match = post.recommendation
  if (!match) {return []}
  const reasons = []
  const labels = { bien: 'bienes', servicio: 'servicios', ambos: 'bienes y servicios' }
  if (match.matched_nature && labels[match.requested_nature]) {
    reasons.push(`La empresa ofrece ${labels[match.requested_nature]}.`)
  }
  if (match.matched_sector && match.sector_name) {reasons.push(`Su rubro es ${match.sector_name}.`)}
  const positiveTags = (post.post_tags ?? [])
    .filter(row => Number(row.tags?.user_tag_scores?.[0]?.score) > 0)
    .map(row => row.tags.name)
  if (positiveTags.length > 0) {reasons.push(`Etiquetas afines a tus intereses: ${positiveTags.join(', ')}.`)}
  if (reasons.length === 0) {reasons.push('Una publicación para explorar; todavía no hay coincidencias con tus intereses por etiquetas.')}
  return reasons
}
