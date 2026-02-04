/**
 * Path manipulation utilities
 */

import path from "path"
import { fileURLToPath } from "url"

/**
 * Resolves a path relative to the project directory
 */
export function resolveProjectPath(projectDir: string, relativePath: string): string {
    return path.resolve(projectDir, relativePath)
}

/**
 * Gets a relative path from the project directory
 */
export function getRelativePath(projectDir: string, absolutePath: string): string {
    return path.relative(projectDir, absolutePath)
}

/**
 * Ensures a directory path ends with a separator
 */
export function ensureTrailingSlash(dirPath: string): string {
    return dirPath.endsWith(path.sep) ? dirPath : dirPath + path.sep
}

/**
 * Gets the directory name from an import.meta.url (ESM)
 */
export function getDirname(importMetaUrl: string): string {
    return path.dirname(fileURLToPath(importMetaUrl))
}

/**
 * Normalizes a file path by:
 * - Converting backslashes to forward slashes
 * - Resolving . and .. segments
 * - Removing duplicate slashes
 */
export function normalizePath(filePath: string): string {
    if (!filePath) return ""

    const isAbsolute = filePath.startsWith("/")
    const segments = filePath.replace(/\\/g, "/").split("/")
    const stack: string[] = []

    for (const segment of segments) {
        if (!segment || segment === ".") {
            continue
        }

        if (segment === "..") {
            if (stack.length > 0) {
                stack.pop()
            }
            continue
        }

        stack.push(segment)
    }

    const normalized = stack.join("/")
    if (isAbsolute) {
        return `/${normalized}`
    }

    return normalized
}
