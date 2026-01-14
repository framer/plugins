// Types

export { hashContent, shortProjectHash } from "./hash.js"
export {
    canonicalFileName,
    capitalizeFirstLetter,
    ensureExtension,
    isSupportedExtension,
    normalizeCodeFilePath,
    normalizePath,
    pluralize,
    sanitizeFilePath,
    stripExtension,
} from "./paths.js"

// Utilities
export { getPortFromHash } from "./ports.js"
// Sync tracker
export { createSyncTracker, type SyncTracker } from "./sync-tracker.js"
export type {
    CliToPluginMessage,
    ConflictSummary,
    ConflictVersionData,
    ConflictVersionRequest,
    FileInfo,
    Mode,
    PendingDelete,
    PluginToCliMessage,
    ProjectInfo,
} from "./types.js"
export { isCliToPluginMessage } from "./types.js"
