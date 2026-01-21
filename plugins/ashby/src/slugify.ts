// Note: We don't use the "slugify" package here because we want a very specific
// behavior for our CMS and web pages. Make sure to pick the right slugify
// function for your use case!
// Characters that are problematic in URLs and should be replaced with dashes:
// - Whitespace (\s)
// - Underscore (_) - Google specifically recommends using `-` instead https://developers.google.com/search/docs/crawling-indexing/url-structure#:~:text=example.com/%F0%9F%A6%99%E2%9C%A8-,Use%20hyphens%20to%20separate%20words,-We%20recommend%20separating
// - URL reserved delimiters: ? # [ ] @
// - Characters with special meaning: ! $ & ' * + , ; : = " < > % { } | \ ^ ` /
//   - : denotes paths on MacOS / reserved for drive letters on Windows
// All other characters (including unicode letters, numbers, symbols) are kept.
const unsafeSlugCharactersRegExp = /[\s_?#[\]@!$&'*+,;:="<>%{}|\\^`/]+/gu
/**
 * Trim leading and trailing dashes from a string.
 * We can't use a regexp, because matching e.g. /-+$/gu leads to polynomial backtracking with e.g. '-'.repeat(54773) + '\x00-'
 */
export function trimDashes(str: string): string {
    let start = 0
    let end = str.length
    while (start < end && str[start] === "-") start++
    while (end > start && str[end - 1] === "-") end--
    return str.slice(start, end)
}
/**
 * Takes a freeform string and converts it to a URL-safe slug.
 * Replaces problematic URL characters and combinations with dashes while preserving:
 * - Unicode letters and numbers
 * - Unicode symbols (±, §, etc.)
 * - URL-safe punctuation: - . ~ ( )
 */
export function slugify(value: string): string {
    return trimDashes(value.trim().toLowerCase().replace(unsafeSlugCharactersRegExp, "-"))
}
