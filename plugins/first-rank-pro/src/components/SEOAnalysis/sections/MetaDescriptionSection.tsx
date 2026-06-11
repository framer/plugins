import { GoodVsBadIcon, HelpIcon, MagicWandIcon } from "../../../assets/icons"
import type { UseAIGenerationReturn } from "../../../hooks/useAIGeneration"
import { Accordion } from "../../common/Accordion"
import { SearchPreview } from "../shared/SearchPreview"
import { StatusBadge } from "../shared/StatusBadge"
import "../styles.css"

interface MetaDescriptionSectionProps {
    status: string
    description: string
    pageName: string
    title: string
    metaDescription: string
    ai?: UseAIGenerationReturn
}

export function MetaDescriptionSection({
    status,
    description,
    pageName,
    title,
    metaDescription,
    ai,
}: MetaDescriptionSectionProps) {
    return (
        <div className="optimization-section">
            <StatusBadge status={status} description={description} />

            {(status === "pass" || status === "warning") && (
                <div className="field-group">
                    <div className="field-label-group">
                        <label className="field-label">Page Description</label>
                        <div className="field-char-count">
                            {metaDescription.length > 200 ? (
                                <span className="warning">
                                    {" "}
                                    {metaDescription.length}/200 (too long - max 200 chars)
                                </span>
                            ) : metaDescription.length < 40 ? (
                                <span className="warning">
                                    {" "}
                                    {metaDescription.length}/200 (too short - min 40 chars)
                                </span>
                            ) : (
                                <span>{metaDescription.length}/200 chars</span>
                            )}
                        </div>
                    </div>
                    <textarea
                        value={metaDescription}
                        readOnly
                        placeholder="Enter page description..."
                        className="field-input"
                        disabled={true}
                        rows={3}
                    />
                </div>
            )}

            {ai && (
                <div className="ai-section">
                    <button
                        className="ai-generate-button"
                        onClick={() => {
                            void ai.generate("meta", pageName).catch((error: unknown) => {
                                console.error("Error generating meta description:", error)
                            })
                        }}
                        disabled={ai.generating.meta}
                    >
                        <MagicWandIcon />
                        {ai.generating.meta ? "Generating..." : "Generate new Description"}
                    </button>
                </div>
            )}

            {ai?.generating.meta ? (
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
            ) : ai?.suggestions.meta && ai.suggestions.meta.length > 0 ? (
                <div className="ai-suggestions">
                    <label className="field-label">AI Suggestions</label>
                    {ai.suggestions.meta.map((suggestion, index) => (
                        <div key={index} className="ai-suggestion-card">
                            <div className="ai-suggestion-text">{suggestion}</div>
                            <div className="ai-suggestion-char-button-group">
                                <div className="ai-suggestion-char-count">
                                    {suggestion.length > 200 ? (
                                        <span className="warning">{suggestion.length}/200 (too long)</span>
                                    ) : suggestion.length < 40 ? (
                                        <span className="warning">{suggestion.length}/200 (too short)</span>
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
                        Copy the suggestion and update it in Framer: Page Settings → Description
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
            <Accordion title="Why Page Description matters?" icon={<HelpIcon className="help-icon" />}>
                <ul>
                    <li>Clear, keyword-rich descriptions boost clicks & engagement</li>
                    <li>Doesn't affect rankings but influences user decisions</li>
                    <li>Acts like an elevator pitch (1–2 sentences)</li>
                </ul>
            </Accordion>

            <Accordion title="Good vs Bad Page Description" icon={<GoodVsBadIcon className="good-vs-bad-icon" />}>
                <div className="good-pill-group">
                    <div className="good-pill">Good</div>
                    <div className="good-pill-example">
                        Resolve customer queries instantly with ChatSphere – an AI-powered chatbot built to support
                        teams and improve response times.
                    </div>
                </div>
                <ul>
                    <li>Includes focus keyword naturally</li>
                    <li>Explains page content in 1–2 sentences</li>
                    <li>Relevant length between 40-200 characters</li>
                </ul>

                <div className="bad-pill-group">
                    <div className="bad-pill">Bad</div>
                    <div className="bad-pill-example">
                        Welcome to our homepage. Click to learn more about what we do.
                    </div>
                </div>
                <ul>
                    <li>Generic, no keyword, doesn't explain page content</li>
                </ul>
            </Accordion>

            <Accordion title="How to set Page Description?" icon={<HelpIcon className="help-icon" />}>
                <ul>
                    <li>In Framer Left Panel, click the [⋮] menu next to page name</li>
                    <li>Select Settings</li>
                    <li>Enter a new Description in the input box</li>
                    <li>Click Save to apply</li>
                </ul>
            </Accordion>

            <SearchPreview pageName={pageName} title={title} description={metaDescription} />
        </div>
    )
}
