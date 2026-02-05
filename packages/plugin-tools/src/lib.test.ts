import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { detectPackageManager } from "./lib"

describe("detectPackageManager", () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pm-detect-"))
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true })
    })

    it("detects yarn from yarn.lock", () => {
        fs.writeFileSync(path.join(tmpDir, "yarn.lock"), "")
        expect(detectPackageManager(tmpDir)).toBe("yarn")
    })

    it("detects pnpm from pnpm-lock.yaml", () => {
        fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "")
        expect(detectPackageManager(tmpDir)).toBe("pnpm")
    })

    it("detects bun from bun.lockb", () => {
        fs.writeFileSync(path.join(tmpDir, "bun.lockb"), "")
        expect(detectPackageManager(tmpDir)).toBe("bun")
    })

    it("detects bun from bun.lock", () => {
        fs.writeFileSync(path.join(tmpDir, "bun.lock"), "")
        expect(detectPackageManager(tmpDir)).toBe("bun")
    })

    it("detects npm from package-lock.json", () => {
        fs.writeFileSync(path.join(tmpDir, "package-lock.json"), "{}")
        expect(detectPackageManager(tmpDir)).toBe("npm")
    })

    it("defaults to npm when no lockfile found", () => {
        expect(detectPackageManager(tmpDir)).toBe("npm")
    })

    it("finds lockfile in parent directory", () => {
        const childDir = path.join(tmpDir, "packages", "child")
        fs.mkdirSync(childDir, { recursive: true })
        fs.writeFileSync(path.join(tmpDir, "yarn.lock"), "")
        expect(detectPackageManager(childDir)).toBe("yarn")
    })

    it("finds lockfile up to 2 levels up", () => {
        const deepDir = path.join(tmpDir, "a", "b")
        fs.mkdirSync(deepDir, { recursive: true })
        fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "")
        expect(detectPackageManager(deepDir)).toBe("pnpm")
    })

    it("does not find lockfile more than 3 levels up", () => {
        const deepDir = path.join(tmpDir, "a", "b", "c")
        fs.mkdirSync(deepDir, { recursive: true })
        fs.writeFileSync(path.join(tmpDir, "yarn.lock"), "")
        expect(detectPackageManager(deepDir)).toBe("npm")
    })

    it("prefers closer lockfile over parent", () => {
        const childDir = path.join(tmpDir, "child")
        fs.mkdirSync(childDir)
        fs.writeFileSync(path.join(tmpDir, "yarn.lock"), "")
        fs.writeFileSync(path.join(childDir, "pnpm-lock.yaml"), "")
        expect(detectPackageManager(childDir)).toBe("pnpm")
    })
})
