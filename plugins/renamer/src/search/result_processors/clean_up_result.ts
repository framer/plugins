import type { Result } from "../types";

import * as text from "../../utils/text";

const WORDS_IGNORING_CAPITALIZATION = ["at"];

export function cleanUpResult(result: Result): string {
  return result.title
    .replace(/_|-|#/g, " ")
    .split(" ")
    .map((word) => {
      if (WORDS_IGNORING_CAPITALIZATION.includes(word)) return word;
      return text.capitalize(word);
    })
    .join(" ");
}
