import { literalPattern, quotedFilter, searchParam } from './searchUtils.js'

export const PROFILES_PAGE_SIZE = 20

export async function searchProfiles(client, { text = '', tag = '', page = 1, pageSize = PROFILES_PAGE_SIZE, signal } = {}) {
  text = searchParam(text)
  tag = searchParam(tag)
  const columns = ['id', 'full_name', 'role', 'avatar_url', 'bio', 'profile_tags(tags(id, name))']
  if (text) {
    columns.push('matching_tags:profile_tags(tags!inner(name))')
  }
  if (tag) {
    columns.push('selected_tags:profile_tags!inner(tags!inner(name))')
  }

  let query = client.from('profiles').select(columns.join(','), { count: 'exact' })
  if (text) {
    const pattern = literalPattern(text)
    const quoted = quotedFilter(pattern)
    // A profile can match its name even when it has no tags or publications.
    query = query
      .filter('matching_tags.tags.name', 'imatch', pattern)
      .or(`full_name.imatch.${quoted},matching_tags.not.is.null`)
  }
  if (tag) {
    query = query.eq('selected_tags.tags.name', tag)
  }

  const start = (page - 1) * pageSize
  query = query
    .order('full_name', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
    .range(start, start + pageSize - 1)
  if (signal) {
    query = query.abortSignal(signal)
  }

  const { data, count, error } = await query
  if (error) {
    throw error
  }
  return { profiles: data ?? [], total: count ?? 0 }
}
