import { FailArrowIcon, OptimizedIcon, UnoptimizedIcon, WarningArrowIcon, WarningIcon } from "../../../assets/icons"
import type { HeadingIssue, SEOAnalysis } from "../../../types/seo"
import "../styles.css"
import { HeadingTree } from "../HeadingTree"

interface QuickSummarySectionProps {
    analysis: SEOAnalysis
    onTabSelect: (tab: string) => void
}

function getStatusIcon(status: string) {
    switch (status) {
        case "pass":
            return <OptimizedIcon />
        case "fail":
            return <UnoptimizedIcon />
        case "warning":
            return <WarningIcon />
        default:
            return null
    }
}

export function QuickSummarySection({ analysis, onTabSelect }: QuickSummarySectionProps) {
    const { checks, extractedData, focusKeyword } = analysis

    // Helper to find specific check
    const getCheck = (id: string) => checks.find(c => c.id === id)

    // Get all checks
    const keywordCheck = getCheck("main-keyword")
    const titleCheck = getCheck("page-title")
    const metaCheck = getCheck("page-description")
    const h1Check = getCheck("h1-check")
    const hierarchyCheck = getCheck("hierarchy-check")
    const placementCheck = getCheck("keyword-placement")
    const imageCheck = getCheck("image-alts")
    const contentCheck = getCheck("content-length")

    const h1s = extractedData.headings.filter(h => h.level === "h1" && !h.duplicateOf)
    const h2s = extractedData.headings.filter(h => h.level === "h2" && !h.duplicateOf)
    const h3s = extractedData.headings.filter(h => h.level === "h3" && !h.duplicateOf)
    const h4s = extractedData.headings.filter(h => h.level === "h4" && !h.duplicateOf)
    const h5s = extractedData.headings.filter(h => h.level === "h5" && !h.duplicateOf)
    const h6s = extractedData.headings.filter(h => h.level === "h6" && !h.duplicateOf)

    const parseHeadingIssues = (evidence: string): HeadingIssue[] => {
        try {
            const parsed: unknown = JSON.parse(evidence || "[]")
            return Array.isArray(parsed) ? (parsed as HeadingIssue[]) : []
        } catch {
            return []
        }
    }

    return (
        <div className="optimization-section quick-summary">
            {/* Main Keyword */}
            {keywordCheck?.status === "pass" ? (
                <button
                    className="clickable"
                    onClick={() => {
                        onTabSelect("main-keyword")
                    }}
                >
                    <div className="field-group">
                        <div className="field-label-group">
                            <div className="field-label-group-summary">
                                <span className="status-icon-small">{getStatusIcon(keywordCheck.status)}</span>
                                <label className={`field-label-summary ${keywordCheck.status}`}>Main Keyword</label>
                            </div>

                            <div className="field-char-count">
                                {focusKeyword.length > 60 ? (
                                    <span>{focusKeyword.length}/60 (too long - max 60 chars)</span>
                                ) : focusKeyword.length < 3 ? (
                                    <span>{focusKeyword.length}/60 (too short - min 3 chars)</span>
                                ) : (
                                    <span>{focusKeyword.length}/60 chars</span>
                                )}
                            </div>
                        </div>
                        {focusKeyword && <div className="field-input-group-summary">{focusKeyword}</div>}
                    </div>
                </button>
            ) : keywordCheck?.status === "warning" ? (
                <button
                    className="clickable"
                    onClick={() => {
                        onTabSelect("main-keyword")
                    }}
                >
                    <div className="check-info-summary warning">
                        <div className="field-label-group-summary">
                            <span className="status-icon-small">{getStatusIcon(keywordCheck.status)}</span>
                            <label className={`field-label-summary ${keywordCheck.status}`}>
                                {keywordCheck.description}
                            </label>
                        </div>
                        <WarningArrowIcon />
                    </div>
                </button>
            ) : null}

            <hr />

            {/* Title */}
            {titleCheck?.status === "pass" ? (
                <button
                    className="clickable"
                    onClick={() => {
                        onTabSelect("page-title")
                    }}
                >
                    <div className="field-group">
                        <div className="field-label-group">
                            <div className="field-label-group-summary">
                                <span className="status-icon-small">{getStatusIcon(titleCheck.status)}</span>
                                <label className={`field-label-summary ${titleCheck.status}`}>Page Title</label>
                            </div>

                            <div className="field-char-count">
                                {titleCheck.evidence.length > 90 ? (
                                    <span className="warning">
                                        {" "}
                                        {titleCheck.evidence.length}/90 (too long - max 90 chars)
                                    </span>
                                ) : titleCheck.evidence.length < 30 ? (
                                    <span className="warning">
                                        {" "}
                                        {titleCheck.evidence.length}/90 (too short - min 30 chars)
                                    </span>
                                ) : (
                                    <span>{titleCheck.evidence.length}/90 chars</span>
                                )}
                            </div>
                        </div>
                        {titleCheck.evidence && <div className="field-input-group-summary">{titleCheck.evidence}</div>}
                    </div>
                </button>
            ) : titleCheck?.status === "fail" ? (
                <button
                    className="clickable"
                    onClick={() => {
                        onTabSelect("page-title")
                    }}
                >
                    <div className="check-info-summary fail">
                        <div className="field-label-group-summary">
                            <span className="status-icon-small">{getStatusIcon(titleCheck.status)}</span>
                            <label className={`field-label-summary ${titleCheck.status}`}>
                                {titleCheck.description}
                            </label>
                        </div>
                        <FailArrowIcon />
                    </div>
                </button>
            ) : null}

            {/* draw a line here */}
            <hr />

            {/* Meta Description */}
            {metaCheck?.status === "pass" ? (
                <button
                    className="clickable"
                    onClick={() => {
                        onTabSelect("page-description")
                    }}
                >
                    <div className="field-group">
                        <div className="field-label-group">
                            <div className="field-label-group-summary">
                                <span className="status-icon-small">{getStatusIcon(metaCheck.status)}</span>
                                <label className={`field-label-summary ${metaCheck.status}`}>Page Description</label>
                            </div>

                            <div className="field-char-count">
                                {metaCheck.evidence.length > 200 ? (
                                    <span className="warning">
                                        {" "}
                                        {metaCheck.evidence.length}/200 (too long - max 200 chars)
                                    </span>
                                ) : metaCheck.evidence.length < 40 ? (
                                    <span className="warning">
                                        {" "}
                                        {metaCheck.evidence.length}/200 (too short - min 40 chars)
                                    </span>
                                ) : (
                                    <span>{metaCheck.evidence.length}/200 chars</span>
                                )}
                            </div>
                        </div>
                        {metaCheck.evidence && <div className="field-input-group-summary">{metaCheck.evidence}</div>}
                    </div>
                </button>
            ) : metaCheck?.status === "fail" ? (
                <button
                    className="clickable"
                    onClick={() => {
                        onTabSelect("page-description")
                    }}
                >
                    <div className="check-info-summary fail">
                        <div className="field-label-group-summary">
                            <span className="status-icon-small">{getStatusIcon(metaCheck.status)}</span>
                            <label className={`field-label-summary ${metaCheck.status}`}>{metaCheck.description}</label>
                        </div>
                        <FailArrowIcon />
                    </div>
                </button>
            ) : null}

            <hr />

            {/* H1 */}
            {h1Check?.status === "pass" && h1Check.description === "H1 Heading is present" ? (
                <button
                    className="clickable"
                    onClick={() => {
                        onTabSelect("h1-check")
                    }}
                >
                    <div className="field-group">
                        <div className="field-label-group">
                            <div className="field-label-group-summary">
                                <span className="status-icon-small">{getStatusIcon(h1Check.status)}</span>
                                <label className={`field-label-summary ${h1Check.status}`}>H1 Heading</label>
                            </div>

                            <div className="field-char-count">
                                {h1Check.evidence.length > 200 ? (
                                    <span className="warning">{h1Check.evidence.length}/200 (too long)</span>
                                ) : h1Check.evidence.length < 40 ? (
                                    <span className="warning">{h1Check.evidence.length}/200 (too short)</span>
                                ) : (
                                    <span>{h1Check.evidence.length}/200</span>
                                )}
                            </div>
                        </div>
                        {h1Check.evidence && <div className="field-input-group-summary">{h1Check.evidence}</div>}
                    </div>
                </button>
            ) : h1Check?.status === "warning" ? (
                <button
                    className="clickable"
                    onClick={() => {
                        onTabSelect("h1-check")
                    }}
                >
                    <div className="check-info-summary warning">
                        <div className="field-label-group-summary">
                            <span className="status-icon-small">{getStatusIcon(h1Check.status)}</span>
                            <label className={`field-label-summary ${h1Check.status}`}>{h1Check.description}</label>
                        </div>
                        <WarningArrowIcon />
                    </div>
                </button>
            ) : h1Check?.status === "fail" ? (
                <button
                    className="clickable"
                    onClick={() => {
                        onTabSelect("h1-check")
                    }}
                >
                    <div className="check-info-summary fail">
                        <div className="field-label-group-summary">
                            <span className="status-icon-small">{getStatusIcon(h1Check.status)}</span>
                            <label className={`field-label-summary ${h1Check.status}`}>{h1Check.description}</label>
                        </div>
                        <FailArrowIcon />
                    </div>
                </button>
            ) : null}

            <hr />

            {h1Check && (
                <button
                    className="clickable"
                    onClick={() => {
                        onTabSelect("h1-check")
                    }}
                >
                    <div className="field-label-group">
                        <div className="field-label-group-summary">
                            <span className="status-icon-small">{getStatusIcon(h1Check.status)}</span>
                            <label className={`field-label-summary ${h1Check.status}`}>H1-H6 Tag Counts</label>
                        </div>
                    </div>

                    <div className={`heading-counter-container-summary`}>
                        <div
                            className={`heading-count-container ${h1s.length < 1 ? "fail" : ""} ${h1s.length > 1 ? "warning" : ""}`}
                        >
                            <span className="heading-level-badge-container">H1</span>
                            <span className="heading-count-number-container">{h1s.length}</span>
                        </div>
                        <div className={`heading-count-container`}>
                            <span className="heading-level-badge-container">H2</span>
                            <span className="heading-count-number-container">{h2s.length}</span>
                        </div>
                        <div className={`heading-count-container ${h3s.length}`}>
                            <span className="heading-level-badge-container">H3</span>
                            <span className="heading-count-number-container">{h3s.length}</span>
                        </div>
                        <div className={`heading-count-container ${h4s.length}`}>
                            <span className="heading-level-badge-container">H4</span>
                            <span className="heading-count-number-container">{h4s.length}</span>
                        </div>
                        <div className={`heading-count-container ${h5s.length}`}>
                            <span className="heading-level-badge-container">H5</span>
                            <span className="heading-count-number-container">{h5s.length}</span>
                        </div>
                        <div className={`heading-count-container ${h6s.length}`}>
                            <span className="heading-level-badge-container">H6</span>
                            <span className="heading-count-number-container">{h6s.length}</span>
                        </div>
                    </div>
                </button>
            )}

            <hr />

            {/* Keyword Placement */}
            {placementCheck && (
                <button
                    className="clickable"
                    onClick={() => {
                        onTabSelect("keyword-placement")
                    }}
                >
                    <div className="field-label-group">
                        <div className="field-label-group-summary">
                            <span className="status-icon-small">
                                {getStatusIcon(placementCheck.status === "pass" ? "pass" : "warning")}
                            </span>
                            <label
                                className={`field-label-summary ${placementCheck.status === "pass" ? "pass" : "warning"}`}
                            >
                                Main Keyword Placement
                            </label>
                        </div>
                    </div>

                    {/* Parse and show placement evidence */}
                    {(() => {
                        try {
                            // Evidence is produced by our own keyword matcher; parse with optional fields.
                            const evidence = JSON.parse(placementCheck.evidence || "{}") as {
                                keyword?: string
                                title?: { status?: string; description?: string }
                                meta?: { status?: string; description?: string }
                                h1?: { status?: string; description?: string }
                            }

                            // If keyword exists in evidence, show detailed placement
                            if (evidence.keyword) {
                                return (
                                    <div className="keyword-placement-details">
                                        <div className="placement-status-item">
                                            <span className="status-icon-small">{getStatusIcon("pass")}</span>
                                            <span className="placement-text pass">Main Keyword is Set</span>
                                        </div>

                                        <div className="placement-status-items">
                                            <div className="placement-status-item">
                                                <span className="status-icon-small">
                                                    {getStatusIcon(evidence.title?.status ?? "warning")}
                                                </span>
                                                <span
                                                    className={`placement-text ${evidence.title?.status ?? "warning"}`}
                                                >
                                                    {evidence.title?.description ?? "Title check not available"}
                                                </span>
                                            </div>

                                            <div className="placement-status-item">
                                                <span className="status-icon-small">
                                                    {getStatusIcon(evidence.meta?.status ?? "warning")}
                                                </span>
                                                <span
                                                    className={`placement-text ${evidence.meta?.status ?? "warning"}`}
                                                >
                                                    {evidence.meta?.description ?? "Meta check not available"}
                                                </span>
                                            </div>

                                            <div className="placement-status-item">
                                                <span className="status-icon-small">
                                                    {getStatusIcon(evidence.h1?.status ?? "warning")}
                                                </span>
                                                <span className={`placement-text ${evidence.h1?.status ?? "warning"}`}>
                                                    {evidence.h1?.description ?? "H1 check not available"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            }
                        } catch {
                            // If parsing fails, it means no keyword is set
                        }

                        // Show warning state when no keyword
                        return (
                            <div className="keyword-placement-details">
                                <div className="placement-status-item">
                                    <span className="status-icon-small">{getStatusIcon("warning")}</span>
                                    <span className="placement-text warning">{placementCheck.description}</span>
                                </div>
                            </div>
                        )
                    })()}
                </button>
            )}

            <hr />

            {/* Heading Hierarchy */}
            {hierarchyCheck && (
                <>
                    <button
                        className="clickable"
                        onClick={() => {
                            onTabSelect("hierarchy-check")
                        }}
                    >
                        <div className="field-label-group">
                            <div className="field-label-group-summary">
                                <span className="status-icon-small">{getStatusIcon(hierarchyCheck.status)}</span>
                                <label className={`field-label-summary ${hierarchyCheck.status}`}>
                                    {hierarchyCheck.description}
                                </label>
                            </div>
                        </div>
                    </button>
                    {/* HeadingTree renders its own buttons, so it must not live inside the button above */}
                    <div className="heading-tree-section">
                        <HeadingTree
                            headings={extractedData.headings}
                            issues={parseHeadingIssues(hierarchyCheck.evidence)}
                        />
                    </div>
                </>
            )}

            <hr />

            {/* Image Alts */}
            {imageCheck && (
                <button
                    className="clickable"
                    onClick={() => {
                        onTabSelect("image-alts")
                    }}
                >
                    <div className="field-label-group">
                        <div className="field-label-group-summary">
                            <span className="status-icon-small">{getStatusIcon(imageCheck.status)}</span>
                            <label className={`field-label-summary ${imageCheck.status}`}>Image Alts</label>
                        </div>
                    </div>

                    {/* Parse and show image statistics */}
                    {(() => {
                        try {
                            const stats = JSON.parse(imageCheck.evidence || "{}") as {
                                total?: number
                                withAlt?: number
                                withoutAlt?: number
                            }
                            const total = stats.total ?? 0
                            const withAlt = stats.withAlt ?? 0
                            const withoutAlt = stats.withoutAlt ?? 0
                            return (
                                <div className="heading-counter-container-summary">
                                    <div className="heading-count-container">
                                        <span className="heading-level-badge-container"># IMAGES</span>
                                        <span className="heading-count-number-container">{total}</span>
                                    </div>
                                    <div className={`heading-count-container ${withAlt > 0 ? "pass" : ""}`}>
                                        <span className="heading-level-badge-container">WITH ALT</span>
                                        <span className="heading-count-number-container">{withAlt}</span>
                                    </div>
                                    <div className={`heading-count-container ${withoutAlt > 0 ? "fail" : ""}`}>
                                        <span className="heading-level-badge-container">WITHOUT ALT</span>
                                        <span className="heading-count-number-container">{withoutAlt}</span>
                                    </div>
                                </div>
                            )
                        } catch {
                            return <div className="field-input-group-summary">{imageCheck.description}</div>
                        }
                    })()}
                </button>
            )}

            <hr />

            {/* Content Length */}
            {contentCheck?.status === "pass" ? (
                <button
                    className="clickable"
                    onClick={() => {
                        onTabSelect("content-length")
                    }}
                >
                    <div className="field-group">
                        <div className="field-label-group">
                            <div className="field-label-group-summary">
                                <span className="status-icon-small">{getStatusIcon(contentCheck.status)}</span>
                                <label className={`field-label-summary ${contentCheck.status}`}>Content Length</label>
                            </div>
                        </div>
                        {contentCheck.evidence && (
                            <div className="field-input-group-summary">{contentCheck.description}</div>
                        )}
                    </div>
                </button>
            ) : contentCheck?.status === "warning" ? (
                <button
                    className="clickable"
                    onClick={() => {
                        onTabSelect("content-length")
                    }}
                >
                    <div className="check-info-summary warning">
                        <div className="field-label-group-summary">
                            <span className="status-icon-small">{getStatusIcon(contentCheck.status)}</span>
                            <label className={`field-label-summary ${contentCheck.status}`}>
                                {contentCheck.description}
                            </label>
                        </div>
                        <WarningArrowIcon />
                    </div>
                </button>
            ) : null}
        </div>
    )
}
