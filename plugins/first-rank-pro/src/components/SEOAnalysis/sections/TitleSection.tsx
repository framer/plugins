import { GoodVsBadIcon, HelpIcon, MagicWandIcon } from "../../../assets/icons"
import type { UseAIGenerationReturn } from "../../../hooks/useAIGeneration"
import { Accordion } from "../../common/Accordion"
import { SearchPreview } from "../shared/SearchPreview"
import { StatusBadge } from "../shared/StatusBadge"
import "../styles.css"

interface TitleSectionProps {
    status: string
    description: string
    pageName: string
    title: string
    metaDescription: string
    ai?: UseAIGenerationReturn
}

export function TitleSection({ status, description, pageName, title, metaDescription, ai }: TitleSectionProps) {
    return (
        <div className="optimization-section">
            <StatusBadge status={status} description={description} />

            {(status === "pass" || status === "warning") && (
                <div className="field-group">
                    <div className="field-label-group">
                        <label className="field-label">Page Title</label>
                        <div className="field-char-count">
                            {title.length > 90 ? (
                                <span className="warning"> {title.length}/90 (too long - max 90 chars)</span>
                            ) : title.length < 30 ? (
                                <span className="warning"> {title.length}/90 (too short - min 30 chars)</span>
                            ) : (
                                <span>{title.length}/90 chars</span>
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

            {ai && (
                <div className="ai-section">
                    <button
                        className="ai-generate-button"
                        onClick={() => {
                            void ai.generate("title", pageName).catch((error: unknown) => {
                                console.error("Error generating title:", error)
                            })
                        }}
                        disabled={ai.generating.title}
                    >
                        <MagicWandIcon />
                        {ai.generating.title ? "Generating..." : "Generate new Title"}
                    </button>
                </div>
            )}

            {ai?.generating.title ? (
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
            ) : ai?.suggestions.title && ai.suggestions.title.length > 0 ? (
                <div className="ai-suggestions">
                    <label className="field-label">AI Suggestions</label>
                    {ai.suggestions.title.map((suggestion, index) => (
                        <div key={index} className="ai-suggestion-card">
                            <div className="ai-suggestion-text">{suggestion}</div>
                            <div className="ai-suggestion-char-button-group">
                                <div className="ai-suggestion-char-count">
                                    {suggestion.length > 90 ? (
                                        <span className="warning">{suggestion.length}/90 (too long)</span>
                                    ) : suggestion.length < 30 ? (
                                        <span className="warning">{suggestion.length}/90 (too short)</span>
                                    ) : (
                                        <span>{suggestion.length}/90 chars</span>
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
                        Copy the suggestion and update it in Framer: Page Settings → Title
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
            <Accordion title="Why Page Title matters?" icon={<HelpIcon className="help-icon" />}>
                <ul>
                    <li>First thing users see in search results</li>
                    <li>Clear, relevant titles boost clicks and traffic</li>
                    <li>Well-written titles with keywords rank higher in search</li>
                </ul>
            </Accordion>

            <Accordion title="Good vs Bad Page Title" icon={<GoodVsBadIcon className="good-vs-bad-icon" />}>
                <div className="good-pill-group">
                    <div className="good-pill">Good</div>
                    <div className="good-pill-example">AI Chatbot for Customer Support Teams | ChatSphere</div>
                </div>
                <ul>
                    <li>Main keyword / phrase included</li>
                    <li>Page topic obvious to users</li>
                    <li>Relevant length between 30-90 characters</li>
                </ul>

                <div className="bad-pill-group">
                    <div className="bad-pill">Bad</div>
                    <div className="bad-pill-example">Welcome | ChatSphere</div>
                </div>
                <ul>
                    <li>Too generic, no keyword, unclear</li>
                </ul>
            </Accordion>

            <Accordion title="How to set Page Title?" icon={<HelpIcon className="help-icon" />}>
                <ul>
                    <li>In Framer Left Panel, click the [⋮] menu next to page name</li>
                    <li>Select Settings</li>
                    <li>Enter a new Title in the input box</li>
                    <li>Click Save</li>
                </ul>
            </Accordion>

            <SearchPreview pageName={pageName} title={title} description={metaDescription} />
        </div>
    )
}
