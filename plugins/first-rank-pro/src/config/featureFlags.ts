// Feature flags for staged rollout.

// Master switch for every AI-generation surface in the plugin:
// the "Generate new Title / Description / H1 / Main Keyword" buttons,
// AI suggestion cards, AI error banners, and the "✨ Write Alt Text"
// button in the image table.
//
// OFF (false) for the first release — flip to true to bring it all back.
export const AI_GENERATION_ENABLED = false
