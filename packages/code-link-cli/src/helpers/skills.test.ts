import fs from "fs/promises"
import os from "os"
import path from "path"
import { describe, expect, it } from "vitest"
import { findSkillsSourceDir, installSkills } from "./skills.ts"

describe("findSkillsSourceDir", () => {
    it("locates the skills source directory", async () => {
        const dir = await findSkillsSourceDir()
        expect(dir).not.toBeNull()

        const stat = await fs.stat(path.join(dir!, "SKILL.md"))
        expect(stat.isFile()).toBe(true)
    })
})

describe("installSkills", () => {
    it("copies skill files to .skills/<name>/", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cl-skills-"))
        try {
            await installSkills(tmpDir)

            // Read skill name from source to know expected dir
            const sourceDir = await findSkillsSourceDir()
            const content = await fs.readFile(path.join(sourceDir!, "SKILL.md"), "utf-8")
            const nameMatch = /^name:\s*(.+)$/m.exec(content)
            const skillName = nameMatch![1].trim()

            // Verify canonical SKILL.md
            const skillMd = await fs.readFile(path.join(tmpDir, ".skills", skillName, "SKILL.md"), "utf-8")
            expect(skillMd).toContain(`name: ${skillName}`)

            // Verify references dir was copied
            const refsDir = path.join(tmpDir, ".skills", skillName, "references")
            const refs = await fs.readdir(refsDir)
            expect(refs.length).toBeGreaterThan(0)
            expect(refs.some(f => f.endsWith(".md"))).toBe(true)
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true })
        }
    })

    it("creates symlinks for agent directories", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cl-skills-"))
        try {
            await installSkills(tmpDir)

            const sourceDir = await findSkillsSourceDir()
            const content = await fs.readFile(path.join(sourceDir!, "SKILL.md"), "utf-8")
            const nameMatch = /^name:\s*(.+)$/m.exec(content)
            const skillName = nameMatch![1].trim()

            const agentDirs = [".agents/skills", ".claude/skills", ".cursor/skills"]
            for (const agentDir of agentDirs) {
                const linkPath = path.join(tmpDir, agentDir, skillName)
                const stat = await fs.lstat(linkPath)
                expect(stat.isSymbolicLink()).toBe(true)

                // Verify the symlink resolves to the canonical SKILL.md
                const skillMd = await fs.readFile(path.join(linkPath, "SKILL.md"), "utf-8")
                expect(skillMd).toContain(`name: ${skillName}`)
            }
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true })
        }
    })

    it("is idempotent — skips if already installed", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cl-skills-"))
        try {
            await installSkills(tmpDir)

            const sourceDir = await findSkillsSourceDir()
            const content = await fs.readFile(path.join(sourceDir!, "SKILL.md"), "utf-8")
            const nameMatch = /^name:\s*(.+)$/m.exec(content)
            const skillName = nameMatch![1].trim()

            const skillMdPath = path.join(tmpDir, ".skills", skillName, "SKILL.md")
            const firstStat = await fs.stat(skillMdPath)

            await new Promise(resolve => setTimeout(resolve, 50))
            await installSkills(tmpDir)

            const secondStat = await fs.stat(skillMdPath)
            expect(secondStat.mtimeMs).toBe(firstStat.mtimeMs)
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true })
        }
    })
})
