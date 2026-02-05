import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import AdmZip from "adm-zip"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { detectPackageManager, zipPluginDistribution } from "./lib"

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

describe("zipPluginDistribution", () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pack-plugin-"))
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true })
    })

    it("creates a ZIP file with correct contents", () => {
        const distDir = path.join(tmpDir, "dist")
        fs.mkdirSync(distDir)
        fs.writeFileSync(path.join(distDir, "index.js"), "console.log('hello')")
        fs.writeFileSync(path.join(distDir, "index.html"), "<html></html>")

        const result = zipPluginDistribution({
            cwd: tmpDir,
            distPath: "dist",
            zipFileName: "plugin.zip",
        })

        expect(fs.existsSync(result.zipPath)).toBe(true)

        const zip = new AdmZip(result.zipPath)
        const entries = zip.getEntries().map(e => e.entryName)
        expect(entries).toContain("index.js")
        expect(entries).toContain("index.html")

        const jsContent = zip.readAsText("index.js")
        expect(jsContent).toBe("console.log('hello')")
    })

    it("throws error when dist directory does not exist", () => {
        expect(() =>
            zipPluginDistribution({
                cwd: tmpDir,
                distPath: "dist",
                zipFileName: "plugin.zip",
            })
        ).toThrow(/The 'dist' directory does not exist/)
    })

    it("respects custom output filename", () => {
        const distDir = path.join(tmpDir, "dist")
        fs.mkdirSync(distDir)
        fs.writeFileSync(path.join(distDir, "index.js"), "")

        const result = zipPluginDistribution({
            cwd: tmpDir,
            distPath: "dist",
            zipFileName: "my-custom-plugin.zip",
        })

        expect(result.zipPath).toBe(path.join(tmpDir, "my-custom-plugin.zip"))
        expect(fs.existsSync(result.zipPath)).toBe(true)
    })

    it("handles nested directory structures", () => {
        const distDir = path.join(tmpDir, "dist")
        const nestedDir = path.join(distDir, "assets", "images")
        fs.mkdirSync(nestedDir, { recursive: true })
        fs.writeFileSync(path.join(distDir, "index.js"), "")
        fs.writeFileSync(path.join(nestedDir, "logo.png"), "fake-png-data")

        const result = zipPluginDistribution({
            cwd: tmpDir,
            distPath: "dist",
            zipFileName: "plugin.zip",
        })

        const zip = new AdmZip(result.zipPath)
        const entries = zip.getEntries().map(e => e.entryName)
        expect(entries).toContain("index.js")
        expect(entries).toContain("assets/images/logo.png")
    })

    it("returns correct zipPath", () => {
        const distDir = path.join(tmpDir, "dist")
        fs.mkdirSync(distDir)
        fs.writeFileSync(path.join(distDir, "index.js"), "")

        const result = zipPluginDistribution({
            cwd: tmpDir,
            distPath: "dist",
            zipFileName: "output.zip",
        })

        expect(result.zipPath).toBe(path.join(tmpDir, "output.zip"))
    })

    it("supports custom distPath", () => {
        const buildDir = path.join(tmpDir, "build", "output")
        fs.mkdirSync(buildDir, { recursive: true })
        fs.writeFileSync(path.join(buildDir, "bundle.js"), "bundled code")

        const result = zipPluginDistribution({
            cwd: tmpDir,
            distPath: "build/output",
            zipFileName: "plugin.zip",
        })

        const zip = new AdmZip(result.zipPath)
        const entries = zip.getEntries().map(e => e.entryName)
        expect(entries).toContain("bundle.js")
    })
})
