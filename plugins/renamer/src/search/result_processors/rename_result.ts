import type { Result } from "../types";

import * as text from "../../utils/text";

export function renameResult(result: Result, replacement: string) {
  if (!replacement) return result.title;

  return text.replaceAllRanges(result.title, replacement, result.ranges, false);
}
