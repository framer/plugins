import type { Divider, LineDiff } from "./types"

export const isDivider = (diff: LineDiff | undefined | null): diff is Divider => diff?.type === "divider"
