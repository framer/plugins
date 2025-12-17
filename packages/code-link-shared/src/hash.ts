/**
 * Simple content hash for echo prevention
 * Uses length + head + tail to quickly detect content changes
 */
export function hashContent(content: string): string {
  return `${content.length}:${content.slice(0, 50)}:${content.slice(-50)}`
}

/**
 * Base58 alphabet (no 0/O/I/l to avoid confusion)
 */
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

/**
 * Derive a short, deterministic hash from the full Framer project hash.
 * Uses a simple numeric hash encoded in base58 for compactness.
 * Idempotent: if input is already the target length, returns it unchanged.
 */
export function shortProjectHash(fullHash: string, length = 8): string {
  // If already short, return as-is (idempotent)
  if (fullHash.length === length) {
    return fullHash
  }

  // Compute a 32-bit hash from the full hash string
  let h1 = 0
  let h2 = 0
  for (let i = 0; i < fullHash.length; i++) {
    const char = fullHash.charCodeAt(i)
    h1 = Math.imul(h1 ^ char, 0x85ebca6b)
    h2 = Math.imul(h2 ^ char, 0xc2b2ae35)
  }
  // Mix the two hashes
  h1 ^= h2 >>> 16
  h2 ^= h1 >>> 13

  // Convert to base58
  let result = ""
  // Use both h1 and h2 to get more bits
  const combined = [Math.abs(h1), Math.abs(h2)]
  for (const num of combined) {
    let n = num >>> 0 // ensure unsigned
    while (n > 0 && result.length < length) {
      result += BASE58[n % 58]
      n = Math.floor(n / 58)
    }
  }

  // Pad if needed
  while (result.length < length) {
    result += BASE58[0]
  }

  return result.slice(0, length)
}
