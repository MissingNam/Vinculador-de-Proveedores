// "Coca-Cola Femsa" → "CF", "Acme" → "AC"
export function initials(name = '') {
  const words = String(name).trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2)
  return letters.toUpperCase()
}