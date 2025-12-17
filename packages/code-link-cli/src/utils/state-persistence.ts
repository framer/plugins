/**
 * State persistence helper
 *
 * Persists last sync timestamps along with content hashes.
 * We only trust persisted timestamps if the file content hasn't changed
 * (hash matches), because that means the file wasn't edited while CLI was offline.
 */

import fs from "fs/promises"
import path from "path"
import { createHash } from "crypto"
import { debug, warn } from "./logging.js"
import { normalizePath } from "./node-paths.js"

export interface PersistedFileState {
  timestamp: number // Remote modified timestamp from last sync
  contentHash: string // Hash of content when we received the sync confirmation
}

interface PersistedState {
  version: number
  files: Record<string, PersistedFileState>
}

const STATE_FILE_NAME = ".framer-sync-state.json"
const CURRENT_VERSION = 1
const SUPPORTED_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".json"]
const DEFAULT_EXTENSION = ".tsx"

export function normalizePersistedFileName(fileName: string): string {
  let normalized = normalizePath(fileName.trim())
  if (
    !SUPPORTED_EXTENSIONS.some((ext) => normalized.toLowerCase().endsWith(ext))
  ) {
    normalized = `${normalized}${DEFAULT_EXTENSION}`
  }
  return normalized
}

/**
 * Hash file content to detect changes
 */
export function hashFileContent(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex")
}

/**
 * Load persisted state from disk
 */
export async function loadPersistedState(
  projectDir: string
): Promise<Map<string, PersistedFileState>> {
  const statePath = path.join(projectDir, STATE_FILE_NAME)
  const result = new Map<string, PersistedFileState>()

  try {
    const data = await fs.readFile(statePath, "utf-8")
    const parsed = JSON.parse(data) as PersistedState

    if (parsed.version !== CURRENT_VERSION) {
      warn(
        `State file version mismatch (expected ${CURRENT_VERSION}, got ${parsed.version}). Ignoring persisted state.`
      )
      return result
    }

    for (const [fileName, state] of Object.entries(parsed.files)) {
      const normalizedName = normalizePersistedFileName(fileName)
      if (normalizedName !== fileName) {
        debug(
          `Normalized persisted key "${fileName}" -> "${normalizedName}" for compatibility`
        )
      }
      result.set(normalizedName, state)
    }

    debug(`Loaded persisted state for ${result.size} files`)
    return result
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      debug("No persisted state found (first run)")
      return result
    }
    warn("Failed to load persisted state:", err)
    return result
  }
}

/**
 * Save current state to disk
 */
export async function savePersistedState(
  projectDir: string,
  state: Map<string, PersistedFileState>
): Promise<void> {
  const statePath = path.join(projectDir, STATE_FILE_NAME)

  const persistedState: PersistedState = {
    version: CURRENT_VERSION,
    files: Object.fromEntries(state.entries()),
  }

  try {
    await fs.writeFile(statePath, JSON.stringify(persistedState, null, 2))
    debug(`Saved persisted state for ${state.size} files`)
  } catch (err) {
    warn("Failed to save persisted state:", err)
  }
}

/**
 * Validate persisted timestamp against current file content
 * Returns the timestamp only if the content hash matches (file unchanged)
 */
export function validatePersistedTimestamp(
  persistedState: PersistedFileState | undefined,
  currentContent: string
): number | null {
  if (!persistedState) {
    return null
  }

  const currentHash = hashFileContent(currentContent)

  if (currentHash === persistedState.contentHash) {
    debug(
      `Hash matches for persisted state - trusting timestamp ${persistedState.timestamp}`
    )
    return persistedState.timestamp
  }

  debug(
    "Hash mismatch for persisted state - file was edited while CLI was offline"
  )
  return null
}
