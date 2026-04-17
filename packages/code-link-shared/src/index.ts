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
export type {
    CancelledDelete,
    CliSyncMode,
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
