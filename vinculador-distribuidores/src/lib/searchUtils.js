export function searchParam(value) {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' ? first.trim() : ''
}

// Escape regular expressions so punctuation is searched as literal text.
export function literalPattern(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
}

// The OR expression uses PostgREST syntax; quote its values separately.
export function quotedFilter(value) {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', String.raw`\"`)}"`
}
