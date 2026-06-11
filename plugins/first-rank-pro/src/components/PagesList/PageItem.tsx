import React from "react"
import type { Page } from "../../types/page"
import "./styles.css"
import { HomeIcon, PageIcon } from "../../assets/icons"

interface PageItemProps {
    page: Page
    onSelect: (page: Page) => void
    analysisSummary?: {
        pass: number | string
        fail: number | string
        warning: number | string
    }
}

export const PageItem = React.memo(function PageItem({ page, onSelect, analysisSummary }: PageItemProps) {
    return (
        <div
            className="page-item"
            onClick={() => {
                onSelect(page)
            }}
        >
            <div className="page-icon-container">
                <span className="page-icon">{page.name === "Home" ? <HomeIcon /> : <PageIcon />}</span>
                <span className="page-name">{page.name}</span>
            </div>

            {analysisSummary && (
                <div className="analysis-counts">
                    <span className="count-fail" title="Failed checks">
                        {analysisSummary.fail}
                    </span>
                    <span className="count-warning" title="Warning checks">
                        {analysisSummary.warning}
                    </span>
                    <span className="count-pass" title="Passed checks">
                        {analysisSummary.pass}
                    </span>
                </div>
            )}
        </div>
    )
})
