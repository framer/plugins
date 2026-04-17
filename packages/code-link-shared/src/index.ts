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
    CliToPluginMessage,
    ConflictSummary,
    ConflictVersionData,
    ConflictVersionRequest,
    FileInfo,
    PendingDelete,
    PluginToCliMessage,
    ProjectInfo,
    PromptSession,
    SyncPhase,
} from "./types.ts"
export { CLOSE_CODE_REPLACED, isCliToPluginMessage } from "./types.ts"
