import type { SEOHeading } from "../../types/seo"

export interface ExtractOptions {
    dedupe?: boolean
}

/**
 * Extract headings from a document with robust visibility detection
 * and parent-scoped deduplication (HeadingsMap parity)
 */
export function extractHeadings(doc: Document, opts: ExtractOptions = {}): SEOHeading[] {
    const { dedupe = true } = opts
    const win = doc.defaultView as Window

    const nodes = Array.from(doc.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"))
    const results: SEOHeading[] = []

    // Parent-scoped deduplication
    const seenInParent = new Map<string, number>()
    const stack: string[] = []

    nodes.forEach((el, index) => {
        const levelNum = parseInt(el.tagName.slice(1))
        const text = el.textContent.trim()

        if (!text) return

        // Robust visibility check
        if (!isElementHidden(el, win)) {
            // Update stack for parent-scoped deduplication
            let top = stack.at(-1)
            while (top !== undefined && parseInt(top.slice(1)) >= levelNum) {
                stack.pop()
                top = stack.at(-1)
            }
            stack.push(el.tagName.toLowerCase())

            const parentKey = stack.slice(0, -1).join(">")
            const textKey = text.toLowerCase().replace(/\s+/g, " ")
            const key = `h${levelNum}::parent=${parentKey}::text=${textKey}`

            if (dedupe) {
                if (seenInParent.has(key)) {
                    return // Skip duplicates entirely
                } else {
                    seenInParent.set(key, index)
                }
            }

            results.push({
                level: el.tagName.toLowerCase() as SEOHeading["level"],
                text,
                index,
                visible: true,
                id: el.id || undefined,
                parent: getSectionLabel(el),
            })
        }
    })

    return results
}

/**
 * Robust visibility detection for elements
 */
function isElementHidden(el: Element, win: Window): boolean {
    // 1) Semantics/attributes
    if ((el as HTMLElement).hidden) return true
    if (el.getAttribute("aria-hidden") === "true") return true
    if ((el as HTMLElement).closest("[inert]")) return true

    // 2) Inline styles (cheap check, no layout needed)
    const styleAttr = (el as HTMLElement).getAttribute("style") ?? ""
    if (/\bdisplay\s*:\s*none\b/i.test(styleAttr)) return true
    if (/\bcontent-visibility\s*:\s*hidden\b/i.test(styleAttr)) return true
    if (/\bvisibility\s*:\s*hidden\b/i.test(styleAttr)) return true

    // 3) Framer-specific hints (defensive)
    if ((el as HTMLElement).closest('[data-framer-component][data-framer-hidden="true"]')) return true

    // 4) Computed style if available (browser/JSDOM with layout)
    try {
        const cs = win.getComputedStyle(el)
        if (cs.display === "none" || cs.visibility === "hidden" || cs.contentVisibility === "hidden") {
            return true
        }
    } catch {
        // getComputedStyle may not exist; ignore
    }

    // 5) Ancestor hidden?
    const hiddenAncestor = (el as HTMLElement).closest(
        '[hidden],[aria-hidden="true"],[inert],[style*="display:none"],[style*="visibility:hidden"],[style*="content-visibility:hidden"]'
    )
    if (hiddenAncestor) return true

    return false
}

/**
 * Get a short "section" label for context
 */
function getSectionLabel(h: Element): string | undefined {
    // Prefer explicit aria labeling on closest section
    const sec = h.closest("section")
    if (sec) {
        const aria = sec.getAttribute("aria-label")
        if (aria) return aria.trim()

        const labelledBy = sec.getAttribute("aria-labelledby")
        if (labelledBy) {
            const ref = sec.ownerDocument.getElementById(labelledBy)
            if (ref?.textContent) return ref.textContent.trim()
        }
    }

    // Otherwise, landmark roles give a hint
    const lm = h.closest('[role="main"], header, nav, footer, aside')
    if (lm && (lm as HTMLElement).tagName) {
        return (lm as HTMLElement).tagName.toLowerCase()
    }

    return undefined
}
