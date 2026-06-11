import { useEffect, useMemo, useState } from "react"
import { PageDataService } from "../../services/pageDataService"
import type { Page, PublishInfo } from "../../types/page"
import { PageItem } from "./PageItem"
import "./styles.css"

interface SummaryCounts {
    pass: number | string
    fail: number | string
    warning: number | string
}

interface PagesListProps {
    pages: Page[]
    publishInfo: PublishInfo | null
    onPageSelect: (page: Page) => void
    searchTerm: string
}

export function PagesList({ pages, publishInfo, onPageSelect, searchTerm }: PagesListProps) {
    const [analysisSummaries, setAnalysisSummaries] = useState<Record<string, SummaryCounts>>({})

    // Get current deployment times
    const currentDeploymentTimes = useMemo(
        () => ({
            staging: publishInfo?.staging?.deploymentTime ?? null,
            production: publishInfo?.production?.deploymentTime ?? null,
        }),
        [publishInfo]
    )

    // Load analysis summaries for all pages
    useEffect(() => {
        async function loadSummaries() {
            const summaries: Record<string, SummaryCounts> = {}

            for (const page of pages) {
                const summary = await PageDataService.getAnalysisSummary(page.id)

                if (!summary) {
                    // No analysis yet - show dashes
                    summaries[page.id] = { pass: "-", fail: "-", warning: "-" }
                } else {
                    // Always show actual counts, even if site was republished
                    summaries[page.id] = summary.counts
                }
            }

            setAnalysisSummaries(summaries)
        }

        if (pages.length > 0) {
            void loadSummaries()
        }
    }, [pages, currentDeploymentTimes])

    // Memoize filtered pages to prevent unnecessary filtering on every render
    const filteredPages = useMemo(
        () => pages.filter(page => page.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [pages, searchTerm]
    )

    return (
        <div className="pages-list">
            {/* Header row for columns */}
            <div className="pages-list-header">
                <span className="pages-header-title">Pages</span>
                <div className="header-counts">
                    <span className="pages-header-title sub-title">Fail</span>
                    <span className="pages-header-title sub-title">Warn</span>
                    <span className="pages-header-title sub-title">Pass</span>
                </div>
            </div>

            {filteredPages.length === 0 ? (
                <div className="no-pages">
                    <p>No pages found. Make sure your project has pages and is published.</p>
                </div>
            ) : (
                filteredPages.map(page => (
                    <PageItem
                        key={page.id}
                        page={page}
                        onSelect={onPageSelect}
                        analysisSummary={analysisSummaries[page.id]}
                    />
                ))
            )}
        </div>
    )
}
