const nonSlugCharactersRegExp = /[^\p{Letter}\p{Number}()]+/gu
// Match leading/trailing dashes, for trimming purposes.
const trimSlugRegExp = /^-+|-+$/gu

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(nonSlugCharactersRegExp, "-")
    .replace(trimSlugRegExp, "")
}

export function simpleHash(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, "0")
}
