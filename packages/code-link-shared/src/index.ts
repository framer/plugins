// Types
export type {
    Mode,
    ProjectInfo,
    PendingDelete,
    ConflictSummary,
    FileInfo,
    ConflictVersionRequest,
    ConflictVersionData,
    CliToPluginMessage,
    PluginToCliMessage,
} from "./types.js"
export { isCliToPluginMessage } from "./types.js"

// Utilities
export { getPortFromHash } from "./ports.js"
export { hashContent, shortProjectHash } from "./hash.js"
export {
    normalizePath,
    normalizeCodeFilePath,
    stripExtension,
    ensureExtension,
    canonicalFileName,
    sanitizeFilePath,
    isSupportedExtension,
    capitalizeFirstLetter,
    pluralize,
} from "./paths.js"

// Sync tracker
export { createSyncTracker, type SyncTracker } from "./sync-tracker.js"
