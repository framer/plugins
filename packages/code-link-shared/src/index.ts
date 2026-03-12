// Types

export { hashContent, shortProjectHash } from "./hash.ts"
export {
    capitalizeFirstLetter,
    ensureExtension,
    fileKeyForLookup,
    isSupportedExtension,
    normalizeCodeFilePath,
    normalizeCodeFilePathWithExtension,
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
    CancelledDelete,
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
export { CLOSE_CODE_REPLACED, isCliToPluginMessage } from "./types.ts"
