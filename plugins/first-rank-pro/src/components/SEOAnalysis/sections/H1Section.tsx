import { useMemo } from "react"
import { GoodVsBadIcon, HelpIcon, MagicWandIcon } from "../../../assets/icons"
import type { UseAIGenerationReturn } from "../../../hooks/useAIGeneration"
import type { SEOHeading } from "../../../types/seo"
import { Accordion } from "../../common/Accordion"
import { HeadingCounts } from "../HeadingCounts"
import { StatusBadge } from "../shared/StatusBadge"
import "../styles.css"

interface H1SectionProps {
    status: string
    description: string
    headings: SEOHeading[]
    h1Text: string
    ai?: UseAIGenerationReturn
}

export function H1Section({ status, description, headings, h1Text, ai }: H1SectionProps) {
    const visibleH1s = useMemo(() => headings.filter(h => h.level === "h1" && h.visible && !h.duplicateOf), [headings])

    return (
        <div className="optimization-section">
            <StatusBadge status={status} description={description} />

            {/* 1. Always show HeadingCounts at the top */}
            <HeadingCounts headings={headings} />

            {/* 2. Show H1 input field for pass/warning states */}
            {(status === "pass" || status === "warning") && (
                <div className="field-group">
                    {status === "warning" ? (
                        <div className="h1-list">
                            {visibleH1s.map((h1, index, array) => (
                                <div key={index} className="h1-item">
                                    <div className="field-label-group">
                                        <span className="field-label">
                                            H1 #{index + 1} of {array.length}
                                        </span>
                                    </div>
                                    <textarea
                                        value={h1.text}
                                        readOnly
                                        disabled={true}
                                        className="field-input"
                                        rows={2}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="field-label-group">
                                <label className="field-label">H1 Heading</label>
                                <div className="field-char-count">
                                    {h1Text.length > 200 ? (
                                        <span className="warning">{h1Text.length}/200 (too long)</span>
                                    ) : h1Text.length < 40 ? (
                                        <span className="warning">{h1Text.length}/200 (too short)</span>
                                    ) : (
                                        <span>{h1Text.length}/200</span>
                                    )}
                                </div>
                            </div>
                            <textarea value={h1Text} readOnly disabled={true} className="field-input" rows={2} />
                        </>
                    )}
                </div>
            )}

            {ai && (
                <div className="ai-section">
                    <button
                        className="ai-generate-button"
                        onClick={() => {
                            void ai.generate("h1").catch((error: unknown) => {
                                console.error("Error generating H1:", error)
                            })
                        }}
                        disabled={ai.generating.h1}
                    >
                        <MagicWandIcon />
                        {ai.generating.h1 ? "Generating..." : "Generate new H1 Heading"}
                    </button>
                </div>
            )}

            {ai?.generating.h1 ? (
                <div className="ai-suggestions">
                    <label className="field-label">AI Suggestions</label>
                    {[1, 2, 3].map(index => (
                        <div key={index} className="ai-suggestion-card shimmer">
                            <div className="ai-suggestion-content">
                                <div className="shimmer-icon"></div>
                                <div className="shimmer-text"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : ai?.suggestions.h1 && ai.suggestions.h1.length > 0 ? (
                <div className="ai-suggestions">
                    <label className="field-label">AI Suggestions</label>
                    {ai.suggestions.h1.map((suggestion, index) => (
                        <div key={index} className="ai-suggestion-card">
                            <div className="ai-suggestion-text">{suggestion}</div>
                            <div className="ai-suggestion-char-button-group">
                                <div className="ai-suggestion-char-count">
                                    {suggestion.length > 200 ? (
                                        <span className="warning">{suggestion.length}/200 (too long)</span>
                                    ) : suggestion.length < 40 ? (
                                        <span className="warning">
                                            {suggestion.length}/200 (recommended: 40-200 chars)
                                        </span>
                                    ) : (
                                        <span>{suggestion.length}/200 chars</span>
                                    )}
                                </div>
                                <div className="ai-suggestion-actions">
                                    <button
                                        className="ai-suggestion-action-button primary"
                                        onClick={() => {
                                            void navigator.clipboard.writeText(suggestion)
                                        }}
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    <div className="ai-suggestion-note">
                        Copy the suggestion and update it in Framer: Select text layer → Text Settings → Heading 1
                    </div>
                </div>
            ) : null}

            {ai?.error && (
                <div className="ai-error">
                    <span>Error: {ai.error}</span>
                    <button onClick={ai.clearError}>Dismiss</button>
                </div>
            )}

            <label className="field-label">Learn</label>
            <Accordion title="Why H1 Heading matters?" icon={<HelpIcon className="help-icon" />}>
                <ul>
                    <li>Strong H1 improves SEO relevance & accessibility</li>
                    <li>Tells both users & search engines the main topic of the page</li>
                    <li>Clear headings improve user readability & engagement</li>
                </ul>
            </Accordion>

            <Accordion title="Good vs Bad H1 Heading" icon={<GoodVsBadIcon className="good-vs-bad-icon" />}>
                <div className="good-pill-group">
                    <div className="good-pill">Good</div>
                    <div className="good-pill-example">AI Chatbot for Customer Support Teams</div>
                </div>
                <ul>
                    <li>Main keyword / phrase included</li>
                    <li>Only one H1 per page - represents the page main topic</li>
                    <li>Clear & user-friendly</li>
                </ul>

                <div className="bad-pill-group">
                    <div className="bad-pill">Bad</div>
                    <div className="bad-pill-example">Welcome to our website</div>
                </div>
                <ul>
                    <li>Too generic, no keyword</li>
                </ul>
            </Accordion>

            <Accordion title="How to set H1 Heading?" icon={<HelpIcon className="help-icon" />}>
                <ul>
                    <li>Select the text layer you want to use as your H1</li>
                    <li>In the right-hand panel, open Text Settings → Styles</li>
                    <li>
                        Choose an existing style defined as Heading 1, or create a new style and label it Heading 1.
                    </li>
                    <li>Update the text content to include your main keyword naturally (avoid forcing or stuffing).</li>
                </ul>
            </Accordion>
        </div>
    )
}
