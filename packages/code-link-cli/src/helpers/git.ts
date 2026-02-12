/**
 * Git initialization helper — creates a git repo with an initial commit
 * in the project directory if one doesn't already exist.
 */

import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import { debug } from "../utils/logging.ts"

function isInGitRepository(cwd: string): boolean {
    try {
        execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore", cwd })
        return true
    } catch {
        return false
    }
}

function isInMercurialRepository(cwd: string): boolean {
    try {
        execSync("hg --cwd . root", { stdio: "ignore", cwd })
        return true
    } catch {
        return false
    }
}

function isDefaultBranchSet(): boolean {
    try {
        execSync("git config init.defaultBranch", { stdio: "ignore" })
        return true
    } catch {
        return false
    }
}

/**
 * Initialize a git repo in the project directory with an initial commit.
 * No-ops if already inside a git or mercurial repository.
 */
export function tryGitInit(projectDir: string): boolean {
    let didInit = false
    try {
        execSync("git --version", { stdio: "ignore" })

        if (isInGitRepository(projectDir) || isInMercurialRepository(projectDir)) {
            debug("Already in a repository, skipping git init")
            return false
        }

        execSync("git init", { stdio: "ignore", cwd: projectDir })
        didInit = true

        if (!isDefaultBranchSet()) {
            execSync("git checkout -b main", { stdio: "ignore", cwd: projectDir })
        }

        execSync("git add -A", { stdio: "ignore", cwd: projectDir })
        execSync('git commit -m "Initial commit from Framer Code Link"', {
            stdio: "ignore",
            cwd: projectDir,
        })

        debug("Initialized git repository with initial commit")
        return true
    } catch (e) {
        if (didInit) {
            try {
                fs.rmSync(path.join(projectDir, ".git"), { recursive: true, force: true })
            } catch {
                // ignore cleanup failure
            }
        }
        debug("Git init failed", e)
        return false
    }
}
