import { useCallback, useEffect, useState } from "react"

export type Theme = "light" | "dark"

// The effective theme is always driven by document.body[data-framer-theme],
// which is the same attribute Framer sets and all of our CSS keys off.
function getInitialTheme(): Theme {
    const attr = document.body.dataset.framerTheme
    if (attr === "light" || attr === "dark") return attr
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(getInitialTheme)

    // Follow Framer's live theme changes so the plugin still respects the
    // editor appearance by default; a manual toggle just writes the same
    // attribute, which keeps this state (and the icon) in sync.
    useEffect(() => {
        const observer = new MutationObserver(() => {
            const attr = document.body.dataset.framerTheme
            if (attr === "light" || attr === "dark") setTheme(attr)
        })
        observer.observe(document.body, { attributes: true, attributeFilter: ["data-framer-theme"] })
        return () => {
            observer.disconnect()
        }
    }, [])

    const toggleTheme = useCallback(() => {
        setTheme(prev => {
            const next: Theme = prev === "dark" ? "light" : "dark"
            document.body.dataset.framerTheme = next
            return next
        })
    }, [])

    return { theme, toggleTheme }
}
