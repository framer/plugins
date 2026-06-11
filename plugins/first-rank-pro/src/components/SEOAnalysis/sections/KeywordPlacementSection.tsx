import { GoodVsBadIcon, HelpIcon } from "../../../assets/icons"
import { Accordion } from "../../common/Accordion"
import "../styles.css"

interface KeywordPlacementSectionProps {
    status: string
    description: string
    evidence: string
    keyword: string
}

import { OptimizedIcon, UnoptimizedIcon, WarningIcon } from "../../../assets/icons"

interface PlacementCheckEvidence {
    status?: string
    description?: string
    evidence?: string
}

interface KeywordPlacementEvidence {
    keyword?: string
    title?: PlacementCheckEvidence
    meta?: PlacementCheckEvidence
    h1?: PlacementCheckEvidence
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null
}

function parsePlacementCheck(value: unknown): PlacementCheckEvidence | undefined {
    if (!isRecord(value)) return undefined
    return {
        status: typeof value.status === "string" ? value.status : undefined,
        description: typeof value.description === "string" ? value.description : undefined,
        evidence: typeof value.evidence === "string" ? value.evidence : undefined,
    }
}

function parseKeywordPlacementEvidence(evidence: string): KeywordPlacementEvidence | null {
    if (!evidence) return null
    try {
        // Try to parse as JSON first
        const parsed: unknown = JSON.parse(evidence)
        if (!isRecord(parsed)) return null
        return {
            keyword: typeof parsed.keyword === "string" ? parsed.keyword : undefined,
            title: parsePlacementCheck(parsed.title),
            meta: parsePlacementCheck(parsed.meta),
            h1: parsePlacementCheck(parsed.h1),
        }
    } catch {
        // If it's not JSON (like "No focus keyword found"), treat as null
        return null
    }
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

export function KeywordPlacementSection({ status, description, evidence, keyword }: KeywordPlacementSectionProps) {
    const newEvidence = parseKeywordPlacementEvidence(evidence)

    const title = newEvidence?.title?.evidence ?? ""
    const meta = newEvidence?.meta?.evidence ?? ""
    const h1 = newEvidence?.h1?.evidence ?? ""

    const titleLength = title.length
    const metaLength = meta.length
    const h1Length = h1.length
    const keywordLength = keyword.length

    const titleStatus = newEvidence?.title?.status ?? "warning"
    const titleDescription = newEvidence?.title?.description ?? "Title check not available"
    const metaStatus = newEvidence?.meta?.status ?? "warning"
    const metaDescription = newEvidence?.meta?.description ?? "Meta check not available"
    const h1Status = newEvidence?.h1?.status ?? "warning"
    const h1Description = newEvidence?.h1?.description ?? "H1 check not available"

    return (
        <div className="optimization-section">
            <div className={`status-badge-keyword-placement`}>
                <div className="main-keyword-status-badge">
                    <span className={`status-icon`}>
                        {getStatusIcon(description.includes("Main Keyword is Set") ? "pass" : status)}
                    </span>
                    <span className={`status-text ${description.includes("Main Keyword is Set") ? "pass" : status}`}>
                        {description}
                    </span>
                </div>

                {newEvidence ? (
                    <>
                        <div className="field-label-group-keyword-placement">
                            <span className="field-label">Main Keyword Placement Status</span>
                        </div>

                        <div className="main-keyword-status-badge">
                            <span className={`status-icon`}>{getStatusIcon(titleStatus)}</span>
                            <span className={`status-text ${titleStatus}`}>{titleDescription}</span>
                        </div>

                        <div className="main-keyword-status-badge">
                            <span className={`status-icon`}>{getStatusIcon(metaStatus)}</span>
                            <span className={`status-text ${metaStatus}`}>{metaDescription}</span>
                        </div>

                        <div className="main-keyword-status-badge">
                            <span className={`status-icon`}>{getStatusIcon(h1Status)}</span>
                            <span className={`status-text ${h1Status}`}>{h1Description}</span>
                        </div>
                    </>
                ) : (
                    <></>
                )}
            </div>

            {(description.includes("Main Keyword is set") &&
                (newEvidence?.title?.status === "pass" || newEvidence?.title?.status === "warning")) ||
            newEvidence?.meta?.status === "pass" ||
            newEvidence?.meta?.status === "warning" ||
            newEvidence?.h1?.status === "pass" ||
            newEvidence?.h1?.status === "warning" ? (
                <>
                    <div className="field-group">
                        <div className="field-label-group">
                            <label className="field-label">Main Keyword</label>
                            <div className="field-char-count">
                                {keywordLength > 60 ? (
                                    <span className="warning"> {keywordLength}/60 (too long - max 60 chars)</span>
                                ) : keywordLength < 3 ? (
                                    <span className="warning"> {keywordLength}/60 (too short - min 3 chars)</span>
                                ) : (
                                    <span>{keywordLength}/60 chars</span>
                                )}
                            </div>
                        </div>
                        <textarea
                            value={keyword}
                            readOnly
                            placeholder="Enter main keyword..."
                            className="field-input"
                            disabled={true}
                            rows={2}
                        />
                    </div>

                    {newEvidence.title?.status !== "fail" && (
                        <div className="field-group">
                            <div className="field-label-group">
                                <label className="field-label">Page Title</label>
                                <div className="field-char-count">
                                    {titleLength > 90 ? (
                                        <span className="warning"> {titleLength}/90 (too long - max 90 chars)</span>
                                    ) : titleLength < 30 ? (
                                        <span className="warning"> {titleLength}/90 (too short - min 30 chars)</span>
                                    ) : (
                                        <span>{titleLength}/90 chars</span>
                                    )}
                                </div>
                            </div>
                            <textarea
                                value={title}
                                readOnly
                                placeholder="Enter page title..."
                                className="field-input"
                                disabled={true}
                                rows={2}
                            />
                        </div>
                    )}

                    {newEvidence.meta?.status !== "fail" && (
                        <div className="field-group">
                            <div className="field-label-group">
                                <label className="field-label">Page Description</label>
                                <div className="field-char-count">
                                    {metaLength > 200 ? (
                                        <span className="warning"> {metaLength}/200 (too long - max 200 chars)</span>
                                    ) : metaLength < 40 ? (
                                        <span className="warning"> {metaLength}/200 (too short - min 40 chars)</span>
                                    ) : (
                                        <span>{metaLength}/200 chars</span>
                                    )}
                                </div>
                            </div>
                            <textarea
                                value={meta}
                                readOnly
                                placeholder="Enter page description..."
                                className="field-input"
                                disabled={true}
                                rows={3}
                            />
                        </div>
                    )}

                    {newEvidence.h1?.status !== "fail" && (
                        <div className="field-group">
                            <div className="field-label-group">
                                <label className="field-label">H1 Heading</label>
                                <div className="field-char-count">
                                    {h1Length > 200 ? (
                                        <span className="warning"> {h1Length}/200 (too long - max 200 chars)</span>
                                    ) : h1Length < 40 ? (
                                        <span className="warning"> {h1Length}/200 (too short - min 40 chars)</span>
                                    ) : (
                                        <span>{h1Length}/200 chars</span>
                                    )}
                                </div>
                            </div>
                            <textarea
                                value={h1}
                                readOnly
                                placeholder="Enter H1 heading..."
                                className="field-input"
                                disabled={true}
                                rows={2}
                            />
                        </div>
                    )}
                </>
            ) : (
                <></>
            )}

            <label className="field-label">Learn</label>
            <Accordion title="What is Main Keyword?" icon={<HelpIcon />}>
                <ul>
                    <li>The primary search phrase you want this page to rank for in Google</li>
                    <li>
                        Guides how you write the Title, Meta Description, and H1 to ensure your page is optimized for
                        that keyword
                    </li>
                    <li>Chosen by you (designer or site owner), not by Google</li>
                </ul>
            </Accordion>

            {description.includes("Main Keyword is Set") ? (
                <>
                    <Accordion title="Why Keyword Placement in Title, Description, H1 matters?" icon={<HelpIcon />}>
                        <ul>
                            <li>Consistency across Title, Meta, and H1 improves SEO visibility & clicks</li>
                            <li>Keyword presence makes the page clear, relevant</li>
                            <li>First signal Google and users see about your page</li>
                        </ul>
                    </Accordion>

                    <Accordion
                        key="good-vs-bad-keyword"
                        title="Good vs Bad Main Keyword Placement"
                        icon={<GoodVsBadIcon className="good-vs-bad-icon" />}
                    >
                        <div className="good-pill-group">
                            <div className="good-pill">Good</div>
                            <div className="good-pill-example">(Keyword = CRM tool for small businesses)</div>
                        </div>
                        <ul>
                            <li>
                                Title:
                                <span className="good-pill-example">
                                    CRM Tool for Small Businesses | Grow Sales Easily
                                </span>
                            </li>
                            <li>
                                Description:
                                <span className="good-pill-example">
                                    Looking for a CRM tool for small businesses? Manage leads, track sales, and grow
                                    faster with an all-in-one platform.
                                </span>
                            </li>
                            <li>
                                H1:
                                <span className="good-pill-example">
                                    CRM Tool for Small Businesses That Helps You Close More Deals
                                </span>
                            </li>
                        </ul>
                        <span className="field-label">Why is it good?</span>
                        <ul>
                            <li>Keyword appears once in each (natural, not stuffed)</li>
                            <li>Matches it's page intent</li>
                            <li>Clear, user-friendly phrasing</li>
                        </ul>

                        <div className="bad-pill-group">
                            <div className="bad-pill">Bad</div>
                        </div>
                        <ul>
                            <li>
                                Title:
                                <span className="bad-pill-example">Home | ChatSphere</span>
                            </li>
                            <li>
                                Description:
                                <span className="bad-pill-example">
                                    Welcome to our website. Click to learn more about us.
                                </span>
                            </li>
                            <li>
                                H1:
                                <span className="bad-pill-example">All-in-One Platform</span>
                            </li>
                        </ul>
                    </Accordion>
                </>
            ) : (
                <></>
            )}
        </div>
    )
}
