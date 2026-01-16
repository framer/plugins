import { describe, expect, it } from "vitest"
import { shortProjectHash } from "./hash.js"
import { getPortFromHash } from "./ports.js"

describe("shortProjectHash", () => {
    const FULL_HASH = "14c01541d3af3ff6a7cd40ac77a5586f0d273c9c371ac04dd31e4410b411c8f5"

    it("returns 8 chars by default", () => {
        const short = shortProjectHash(FULL_HASH)
        expect(short).toHaveLength(8)
    })

    it("returns requested length", () => {
        expect(shortProjectHash(FULL_HASH, 6)).toHaveLength(6)
        expect(shortProjectHash(FULL_HASH, 10)).toHaveLength(10)
    })

    it("is deterministic", () => {
        const a = shortProjectHash(FULL_HASH)
        const b = shortProjectHash(FULL_HASH)
        expect(a).toBe(b)
    })

    it("produces different ids for different hashes", () => {
        const hash2 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        expect(shortProjectHash(FULL_HASH)).not.toBe(shortProjectHash(hash2))
    })

    it("uses only base58 characters", () => {
        const short = shortProjectHash(FULL_HASH)
        const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/
        expect(short).toMatch(base58Regex)
    })

    it("is idempotent (short id of short id equals short id)", () => {
        const short = shortProjectHash(FULL_HASH)
        const shortOfShort = shortProjectHash(short)
        expect(shortOfShort).toBe(short)
    })
})

describe("getPortFromHash", () => {
    const FULL_HASH = "14c01541d3af3ff6a7cd40ac77a5586f0d273c9c371ac04dd31e4410b411c8f5"

    it("returns port in valid range", () => {
        const port = getPortFromHash(FULL_HASH)
        expect(port).toBeGreaterThanOrEqual(3847)
        expect(port).toBeLessThanOrEqual(4096)
    })

    it("is deterministic", () => {
        const a = getPortFromHash(FULL_HASH)
        const b = getPortFromHash(FULL_HASH)
        expect(a).toBe(b)
    })

    it("returns same port for full hash and its short id", () => {
        const short = shortProjectHash(FULL_HASH)
        expect(getPortFromHash(FULL_HASH)).toBe(getPortFromHash(short))
    })

    it("produces different ports for different hashes", () => {
        const hash2 = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        // Note: could collide in theory, but extremely unlikely for these inputs
        expect(getPortFromHash(FULL_HASH)).not.toBe(getPortFromHash(hash2))
    })
})
