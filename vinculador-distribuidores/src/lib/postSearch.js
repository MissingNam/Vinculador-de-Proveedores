export const POSTS_PAGE_SIZE = 20

export function searchParam(value) {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' ? first.trim() : ''
}

// Escape regular expressions so punctuation is searched as literal text.
function literalPattern(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
}

// The OR expression uses PostgREST syntax; quote its values separately.
function quotedFilter(value) {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', String.raw`\"`)}"`
}

export async function searchPosts(client, { text = '', tag = '', page = 1, pageSize = POSTS_PAGE_SIZE, signal } = {}) {
  text = searchParam(text)
  tag = searchParam(tag)
  const columns = ['*', 'profiles(full_name)', 'post_tags(tags(id, name))']
  if (text) {
    columns.push('matching_tags:post_tags(tags!inner(name))')
  }
  if (tag) {
    columns.push('selected_tags:post_tags!inner(tags!inner(name))')
  }

  let query = client.from('posts').select(columns.join(','), { count: 'exact' })
  if (text) {
    const pattern = literalPattern(text)
    const quoted = quotedFilter(pattern)
    // Keep the displayed post_tags separate from the relations used to filter.
    query = query
      .filter('matching_tags.tags.name', 'imatch', pattern)
      .or(`title.imatch.${quoted},description.imatch.${quoted},matching_tags.not.is.null`)
  }
  if (tag) {
    query = query.eq('selected_tags.tags.name', tag)
  }

  const start = (page - 1) * pageSize
  query = query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(start, start + pageSize - 1)
  if (signal) {
    query = query.abortSignal(signal)
  }

  const { data, count, error } = await query
  if (error) {
    throw error
  }
  return { posts: data ?? [], total: count ?? 0 }
}
