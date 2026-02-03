// Types

export { hashContent, shortProjectHash } from "./hash.ts"
export {
    canonicalFileName,
    capitalizeFirstLetter,
    ensureExtension,
    fileKeyForLookup,
    isSupportedExtension,
    normalizeCodeFilePath,
    normalizePath,
    pluralize,
    sanitizeFilePath,
    stripExtension,
} from "./paths.ts"

// Utilities
export { getPortFromHash } from "./ports.ts"
// Sync tracker
export { createSyncTracker, type SyncTracker } from "./sync-tracker.ts"
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
} from "./types.ts"
export { isCliToPluginMessage } from "./types.ts"
