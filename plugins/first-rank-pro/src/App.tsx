import { framer } from "framer-plugin"
import { useCallback, useMemo, useState } from "react"
import { LoadingSpinner } from "./components/common/LoadingSpinner"
import { PagesList } from "./components/PagesList/PagesList"
import { SEOAnalysis } from "./components/SEOAnalysis/SEOAnalysis"
import { usePages } from "./hooks/usePages"
import { useTheme } from "./hooks/useTheme"
import type { Page } from "./types/page"

import "./App.css"

import { SearchIcon } from "./assets/icons/index.tsx"
import { Navbar } from "./components/Navbar/Navbar"

// Configure Framer plugin UI
void framer.showUI({
    position: "top right",
    width: 660,
    height: 900,
    resizable: true,
})

export function App() {
    const [currentView, setCurrentView] = useState<"pages" | "analysis">("pages")
    const [selectedPage, setSelectedPage] = useState<Page | null>(null)
    const [searchTerm, setSearchTerm] = useState("")

    const { pages, publishInfo, loading, error, refresh, activeUrl, domains, selectDomain } = usePages()
    const { theme, toggleTheme } = useTheme()

    // Memoize the page select handler to prevent unnecessary re-renders
    const handlePageSelect = useCallback((page: Page) => {
        setSelectedPage(page)
        setCurrentView("analysis")
    }, [])

    // Memoize deployment times to prevent unnecessary updates
    const rootDeploymentTimes = useMemo(
        () => ({
            staging: publishInfo?.staging?.deploymentTime ?? null,
            production: publishInfo?.production?.deploymentTime ?? null,
        }),
        [publishInfo?.staging?.deploymentTime, publishInfo?.production?.deploymentTime]
    )

    if (loading || !publishInfo) {
        return <LoadingSpinner />
    }

    return (
        <main className="app-main">
            {currentView === "pages" ? (
                <>
                    <div className="pages-header">
                        {/* Case A: Site is not published, show this state asking user to publish their site */}
                        {error || (!publishInfo.staging?.url && !publishInfo.production?.url) ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">
                                    <svg
                                        width="80"
                                        height="80"
                                        viewBox="0 0 80 80"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <circle cx="40" cy="40" r="40" fill="#F3F4F6" />
                                        <path
                                            d="M40 20C28.954 20 20 28.954 20 40C20 51.046 28.954 60 40 60C51.046 60 60 51.046 60 40C60 28.954 51.046 20 40 20ZM40 55C31.716 55 25 48.284 25 40C25 31.716 31.716 25 40 25C48.284 25 55 31.716 55 40C55 48.284 48.284 55 40 55Z"
                                            fill="#9CA3AF"
                                        />
                                        <path
                                            d="M40 30V42L48 46"
                                            stroke="#9CA3AF"
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </div>
                                <h2 className="empty-state-title">Site Not Published</h2>
                                <p className="empty-state-message">
                                    Please publish your site to start analyzing SEO.
                                    <br />
                                    Go to the Framer top menu and click "Publish"
                                </p>
                                <div className="empty-state-hint">
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 16 16"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 8 1Z"
                                            stroke="#6B7280"
                                            strokeWidth="1.5"
                                        />
                                        <path d="M8 5V8.5" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
                                        <circle cx="8" cy="11" r="0.75" fill="#6B7280" />
                                    </svg>
                                    <span>First Rank Pro analyzes your live published site</span>
                                </div>
                            </div>
                        ) : (
                            <>
                                <Navbar
                                    url={activeUrl ?? "No URL"}
                                    score={75}
                                    theme={theme}
                                    domains={domains}
                                    onDomainChange={selectDomain}
                                    onAuditClick={() => {
                                        void refresh()
                                    }}
                                    onToggleTheme={toggleTheme}
                                />
                                <div className="pages-content">
                                    <div className="search-container">
                                        <SearchIcon />
                                        <input
                                            type="text"
                                            placeholder="Search Pages"
                                            value={searchTerm}
                                            onChange={e => {
                                                setSearchTerm(e.target.value)
                                            }}
                                            className="search-input"
                                        />
                                    </div>
                                    <PagesList
                                        pages={pages}
                                        publishInfo={publishInfo}
                                        onPageSelect={handlePageSelect}
                                        searchTerm={searchTerm}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </>
            ) : (
                selectedPage && (
                    <SEOAnalysis
                        page={selectedPage}
                        publishInfo={publishInfo}
                        rootDeploymentTimes={rootDeploymentTimes}
                        onBack={() => {
                            setCurrentView("pages")
                            setSelectedPage(null)
                        }}
                    />
                )
            )}
        </main>
    )
}
