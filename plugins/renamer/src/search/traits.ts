import type { CanvasNode } from "./types";

import { isComponentInstanceNode, isFrameNode, isSVGNode, isTextNode } from "framer-plugin";

export function isCanvasNode(value: unknown): value is CanvasNode {
  if (isFrameNode(value)) return true;
  if (isComponentInstanceNode(value)) return true;
  if (isTextNode(value)) return true;
  if (isSVGNode(value)) return true;

  return false;
}
