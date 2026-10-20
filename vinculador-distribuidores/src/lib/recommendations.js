export const WINDOW_SIZE = 9   // posts en la ventana
export const BUFFER = 4        // posts a cada lado del actual

const POST_COLUMNS = '*, affinity, profiles(full_name, role), post_tags(tags(id, name))'

export async function fetchRecommendations(client, { limit, excludeIds = [], roles = null, signal } = {}) {
  let query = client
    .rpc('recommend_posts', { p_limit: limit, p_exclude: excludeIds, p_roles: roles })
    .select(POST_COLUMNS)
  if (signal) query = query.abortSignal(signal)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}