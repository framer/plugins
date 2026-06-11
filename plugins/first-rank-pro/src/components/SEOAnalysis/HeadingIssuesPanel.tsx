import type { HeadingIssue } from "../../types/seo"
import "./HeadingIssuesPanel.css"
import { UnoptimizedIcon, WarningIcon } from "../../assets/icons"

interface HeadingIssuesPanelProps {
    issues: HeadingIssue[]
    onLocateHeading?: (index: number) => void
}

export function HeadingIssuesPanel({ issues }: HeadingIssuesPanelProps) {
    if (issues.length === 0) return null

    const getIssueDescription = (issue: HeadingIssue): string => {
        switch (issue.type) {
            case "jump":
                return `Jump detected: ${issue.previousHeading?.level.toUpperCase() ?? "?"} "${issue.previousHeading?.text ?? ""}" → ${issue.level.toUpperCase()} "${issue.text}"`
            case "missing_level":
                return `${issue.level.toUpperCase()} "${issue.text}" found without ${issue.missingLevel?.toUpperCase() ?? "parent level"}`
            case "missing_h1":
                return "No H1 heading found on this page"
            case "multiple_h1":
                return `Multiple H1: "${issue.text}"`
            default:
                return "Unknown issue"
        }
    }

    return (
        <div className="heading-issues-panel">
            <div className="issues-header">
                <span className="issues-title">Issues Found ({issues.length})</span>
            </div>
            <div className="issues-list">
                {issues.map((issue, index) => (
                    <div key={index} className={`issue-item ${issue.severity}`}>
                        <span className="issue-icon">
                            {issue.severity === "error" ? <UnoptimizedIcon /> : <WarningIcon />}
                        </span>
                        <span className="issue-description">{getIssueDescription(issue)}</span>
                        {/* {issue.index >= 0 && onLocateHeading && (
                            <button 
                                className="issue-locate-button"
                                onClick={() => onLocateHeading(issue.index)}
                            >
                                Locate
                            </button>
                        )} */}
                    </div>
                ))}
            </div>
        </div>
    )
}
