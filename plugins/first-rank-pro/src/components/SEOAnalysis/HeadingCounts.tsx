import type { SEOHeading } from "../../types/seo"
import "./HeadingCounts.css"

interface HeadingCountsProps {
    headings: SEOHeading[]
}

export function HeadingCounts({ headings }: HeadingCountsProps) {
    // Calculate heading counts by level
    const h1s = headings.filter(h => h.level === "h1" && !h.duplicateOf)
    const h2s = headings.filter(h => h.level === "h2" && !h.duplicateOf)
    const h3s = headings.filter(h => h.level === "h3" && !h.duplicateOf)
    const h4s = headings.filter(h => h.level === "h4" && !h.duplicateOf)
    const h5s = headings.filter(h => h.level === "h5" && !h.duplicateOf)
    const h6s = headings.filter(h => h.level === "h6" && !h.duplicateOf)

    return (
        <>
            <label className="field-label">H1-H6 Tag Counts</label>
            <div className={`heading-counter-container`}>
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
        </>
    )
}
