import { cn } from "../utils"

/**
 * One-time fade in animation that runs only once when the element is first rendered
 *
 * The animation starts with opacity 0 and animates to opacity 1 over 150ms
 */
export const fadeInAnimationClassName = cn("animate-[fadeIn_150ms_forwards]")
