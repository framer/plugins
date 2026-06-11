import { useCallback, useEffect, useRef, useState } from "react"
import { FramerService } from "../services/framerService"
import type { Page, PublishInfo } from "../types/page"

// Distinct published domains, custom/production domain first. When the site
// isn't on a custom domain yet, production and staging both report the same
// *.framer.app URL — dedupe so the switcher only offers real alternatives.
function domainsFrom(info: PublishInfo | null): string[] {
    const urls = [info?.production?.url, info?.staging?.url].filter((u): u is string => !!u)
    const seen = new Set<string>()
    return urls.filter(u => {
        const key = u.replace(/\/$/, "")
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

export function usePages() {
    const [publishInfo, setPublishInfo] = useState<PublishInfo | null>(null)
    const [pages, setPages] = useState<Page[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<boolean>(false)
    const [activeUrl, setActiveUrl] = useState<string | undefined>(undefined)

    // Ref lets the subscription callback read the latest selection without
    // re-subscribing on every state change.
    const activeUrlRef = useRef<string | undefined>(undefined)

    // Re-fetch the page list, building URLs from the currently selected domain.
    const loadPages = useCallback(async () => {
        try {
            const projectPages = await FramerService.getPages(activeUrlRef.current)
            // Filter out dynamic pages (with :slug)
            setPages(projectPages.filter(page => !page.url?.endsWith(":slug")))
            setError(false)
        } catch {
            setError(true)
        } finally {
            setLoading(false)
        }
    }, [])

    // Apply fresh publish info; keep the current selection if that domain still
    // exists, otherwise fall back to the first available (custom domain first).
    const applyInfo = useCallback((info: PublishInfo) => {
        setPublishInfo(info)
        const domains = domainsFrom(info)
        const current = activeUrlRef.current
        const next = current && domains.includes(current) ? current : domains[0]
        activeUrlRef.current = next
        setActiveUrl(next)
    }, [])

    // User picks a different available domain.
    const selectDomain = useCallback(
        (url: string) => {
            activeUrlRef.current = url
            setActiveUrl(url)
            setLoading(true)
            void loadPages()
        },
        [loadPages]
    )

    // Manual "Rescan" — pull fresh publish info + pages on demand.
    const refresh = useCallback(async () => {
        setLoading(true)
        try {
            applyInfo(await FramerService.getPublishInfo())
            await loadPages()
        } catch {
            setError(true)
            setLoading(false)
        }
    }, [applyInfo, loadPages])

    useEffect(() => {
        // Guards against React 18 StrictMode's mount→unmount→remount: a late
        // callback from a torn-down subscription must not write state.
        let active = true

        const unsubscribe = FramerService.subscribeToPublishInfo(info => {
            if (!active) return
            applyInfo(info) // updates the top domain instantly on republish
            void loadPages() // re-derive pages from the selected domain
        })

        return () => {
            active = false
            unsubscribe()
        }
    }, [applyInfo, loadPages])

    useEffect(() => {
        if (publishInfo && !publishInfo.staging && !publishInfo.production) {
            setError(true)
        } else if (publishInfo) {
            setError(false)
        }
    }, [publishInfo])

    const domains = domainsFrom(publishInfo)

    return { pages, publishInfo, loading, error, refresh, activeUrl, domains, selectDomain }
}
