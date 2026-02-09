/**
 * Agent Skills installer — copies the skill into the project directory
 * and symlinks it into agent-specific paths.
 */

import { fileURLToPath } from "node:url"
import fs from "fs/promises"
import path from "path"

import { debug } from "../utils/logging.ts"

/** Agent-specific skill directories that get symlinked to the canonical .skills/ location */
const AGENT_SKILL_DIRS = [
    ".agents/skills", // Codex, Amp, Gemini CLI, GitHub Copilot, OpenCode, Kimi, Replit
    ".claude/skills", // Claude Code
    ".cursor/skills", // Cursor
]

/**
 * Read the skill name from the SKILL.md frontmatter.
 */
async function readSkillName(sourceDir: string): Promise<string> {
    const content = await fs.readFile(path.join(sourceDir, "SKILL.md"), "utf-8")
    const match = /^name:\s*(.+)$/m.exec(content)
    if (!match) throw new Error("Could not read skill name from SKILL.md frontmatter")
    return match[1].trim()
}

/**
 * Recursively collect all file paths relative to a directory.
 */
async function collectFiles(dir: string, base = ""): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const files: string[] = []
    for (const entry of entries) {
        const rel = base ? `${base}/${entry.name}` : entry.name
        if (entry.isDirectory()) {
            files.push(...(await collectFiles(path.join(dir, entry.name), rel)))
        } else {
            files.push(rel)
        }
    }
    return files
}

/**
 * Install the agent skill into the project.
 * Writes the canonical skill to .skills/<name>/ and symlinks
 * into agent-specific directories.
 */
export async function installSkills(projectDir: string): Promise<void> {
    // Find the source skills directory shipped with the package
    const sourceDir = await findSkillsSourceDir()
    if (!sourceDir) {
        debug("Could not locate skills source files, skipping skill installation")
        return
    }

    const skillName = await readSkillName(sourceDir)
    const canonicalDir = path.join(projectDir, ".skills", skillName)
    const skillMdPath = path.join(canonicalDir, "SKILL.md")

    try {
        await fs.access(skillMdPath)
        debug("Agent skills already installed")
        return
    } catch {
        // Not installed yet, proceed
    }

    // Discover all files in the source skill directory
    const files = await collectFiles(sourceDir)

    // Copy all skill files to the canonical .skills/ location
    for (const file of files) {
        const src = path.join(sourceDir, file)
        const dest = path.join(canonicalDir, file)
        try {
            await fs.mkdir(path.dirname(dest), { recursive: true })
            await fs.copyFile(src, dest)
        } catch (err) {
            debug(`Failed to copy skill file ${file}`, err)
            return
        }
    }

    debug(`Installed agent skill to .skills/${skillName}/`)

    // Create symlinks from each agent directory to the canonical location
    for (const agentDir of AGENT_SKILL_DIRS) {
        const linkDir = path.join(projectDir, agentDir)
        const linkPath = path.join(linkDir, skillName)
        const relativeTarget = path.relative(linkDir, canonicalDir)

        try {
            await fs.mkdir(linkDir, { recursive: true })

            // Remove existing symlink/dir if present
            try {
                const stat = await fs.lstat(linkPath)
                if (stat.isSymbolicLink() || stat.isDirectory()) {
                    await fs.rm(linkPath, { recursive: true })
                }
            } catch {
                // Doesn't exist, fine
            }

            await fs.symlink(relativeTarget, linkPath, "dir")
            debug(`Symlinked ${agentDir}/${skillName} -> ${relativeTarget}`)
        } catch (err) {
            // Symlink failed (e.g. Windows without dev mode), fall back to copy
            debug(`Symlink failed for ${agentDir}, falling back to copy`, err)
            try {
                await fs.cp(canonicalDir, linkPath, { recursive: true })
            } catch {
                debug(`Copy fallback also failed for ${agentDir}`)
            }
        }
    }
}

/**
 * Find the skills source directory shipped with the package.
 * Walks up from the current file to find the package root, then resolves skills/.
 */
export async function findSkillsSourceDir(): Promise<string | null> {
    let dir = path.dirname(fileURLToPath(import.meta.url))
    for (let i = 0; i < 10; i++) {
        try {
            await fs.access(path.join(dir, "package.json"))
            const candidate = path.join(dir, "skills")
            await fs.access(path.join(candidate, "SKILL.md"))
            return candidate
        } catch {
            const parent = path.dirname(dir)
            if (parent === dir) break
            dir = parent
        }
    }
    return null
}
