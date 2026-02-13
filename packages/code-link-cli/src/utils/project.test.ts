import { shortProjectHash } from "@code-link/shared"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { findOrCreateProjectDirectory, toDirectoryName, toPackageName } from "./project.ts"

describe("toPackageName", () => {
    it("lowercases and replaces invalid chars", () => {
        expect(toPackageName("My Project")).toBe("my-project")
        expect(toPackageName("Hello World!")).toBe("hello-world")
    })
})

describe("toDirectoryName", () => {
    it("replaces invalid chars preserving case and spaces", () => {
        expect(toDirectoryName("My Project")).toBe("My Project")
        expect(toDirectoryName("Hello World!")).toBe("Hello World")
    })
})

describe("findOrCreateProjectDirectory", () => {
    let tmpDir: string

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-test-"))
    })

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it("uses the project name as directory name", async () => {
        const result = await findOrCreateProjectDirectory("hashA", "My Project", undefined, tmpDir)

        expect(result.created).toBe(true)
        expect(path.basename(result.directory)).toBe("My Project")

        const pkg = JSON.parse(await fs.readFile(path.join(result.directory, "package.json"), "utf-8"))
        expect(pkg.shortProjectHash).toBe(shortProjectHash("hashA"))
        expect(pkg.framerProjectName).toBe("My Project")
    })

    it("reuses existing directory when hash matches", async () => {
        const first = await findOrCreateProjectDirectory("hashA", "My Project", undefined, tmpDir)
        const second = await findOrCreateProjectDirectory("hashA", "My Project", undefined, tmpDir)

        expect(first.created).toBe(true)
        expect(second.created).toBe(false)
        expect(second.directory).toBe(first.directory)
    })

    it("creates separate directories for same-named projects with different hashes", async () => {
        const projectA = await findOrCreateProjectDirectory("hashA", "My Project", undefined, tmpDir)
        const projectB = await findOrCreateProjectDirectory("hashB", "My Project", undefined, tmpDir)

        // First gets the bare name, second gets name-hash
        expect(path.basename(projectA.directory)).toBe("My Project")
        expect(path.basename(projectB.directory)).toBe(`My Project-${shortProjectHash("hashB")}`)

        // Must be distinct directories
        expect(projectA.directory).not.toBe(projectB.directory)
        expect(projectA.created).toBe(true)
        expect(projectB.created).toBe(true)

        // Each has correct hash in package.json
        const pkgA = JSON.parse(await fs.readFile(path.join(projectA.directory, "package.json"), "utf-8"))
        const pkgB = JSON.parse(await fs.readFile(path.join(projectB.directory, "package.json"), "utf-8"))
        expect(pkgA.shortProjectHash).toBe(shortProjectHash("hashA"))
        expect(pkgB.shortProjectHash).toBe(shortProjectHash("hashB"))
    })

    it("does not overwrite first project's package.json when second has same name", async () => {
        const projectA = await findOrCreateProjectDirectory("hashA", "My Project", undefined, tmpDir)

        // Write a file into project A to simulate synced state
        await fs.writeFile(path.join(projectA.directory, "files", "Component.tsx"), "export default () => <div/>")

        const projectB = await findOrCreateProjectDirectory("hashB", "My Project", undefined, tmpDir)

        // Project A's package.json must still have its own hash
        const pkgA = JSON.parse(await fs.readFile(path.join(projectA.directory, "package.json"), "utf-8"))
        expect(pkgA.shortProjectHash).toBe(shortProjectHash("hashA"))

        // Project A's files must still exist
        const content = await fs.readFile(path.join(projectA.directory, "files", "Component.tsx"), "utf-8")
        expect(content).toBe("export default () => <div/>")

        // Project B's directory is separate and empty
        const filesB = await fs.readdir(path.join(projectB.directory, "files"))
        expect(filesB).toHaveLength(0)
    })

    it("uses explicit directory when provided", async () => {
        const explicitDir = path.join(tmpDir, "custom-dir")
        const result = await findOrCreateProjectDirectory("hashA", "My Project", explicitDir)

        expect(result.directory).toBe(explicitDir)
        expect(result.created).toBe(false)
    })

    it("falls back to project-[hash] when project name is empty after sanitization", async () => {
        const result = await findOrCreateProjectDirectory("hashA", "!!!", undefined, tmpDir)
        const shortId = shortProjectHash("hashA")

        expect(path.basename(result.directory)).toBe(`project-${shortId}`)
    })
})
