import { useEffect, useState } from "react"
import { GoodVsBadIcon, HelpIcon, MagicWandIcon, SparklesIcon } from "../../../assets/icons"
import type { UseAIGenerationReturn } from "../../../hooks/useAIGeneration"
import { PageDataService } from "../../../services/pageDataService"
import { Accordion } from "../../common/Accordion"
import { StatusBadge } from "../shared/StatusBadge"
import "../styles.css"

interface FocusKeywordSectionProps {
    status: string
    description: string
    pageId: string
    focusKeyword: string
    onFocusKeywordChange: (keyword: string) => void
    onKeywordLoad: (keyword: string) => void
    triggerKeywordAnalysis?: (keyword: string) => Promise<void>
    ai?: UseAIGenerationReturn
}

export function FocusKeywordSection({
    status,
    description,
    pageId,
    focusKeyword,
    onKeywordLoad,
    triggerKeywordAnalysis,
    ai,
}: FocusKeywordSectionProps) {
    const [editedKeyword, setEditedKeyword] = useState(focusKeyword)
    const [isSavingKeyword, setIsSavingKeyword] = useState(false)

    // Keep local state in sync when parent focusKeyword changes
    useEffect(() => {
        setEditedKeyword(focusKeyword)
    }, [focusKeyword])

    // Load saved keyword on mount ONLY if parent hasn't already loaded it
    useEffect(() => {
        // Skip loading if parent already has a keyword to avoid double analysis
        if (focusKeyword) {
            return
        }

        const load = async () => {
            try {
                const coreData = await PageDataService.getCoreData(pageId)
                if (coreData?.focusKeyword) {
                    setEditedKeyword(coreData.focusKeyword)
                    // Use onKeywordLoad to avoid resetting selected check
                    onKeywordLoad(coreData.focusKeyword)
                    if (triggerKeywordAnalysis) {
                        await triggerKeywordAnalysis(coreData.focusKeyword)
                    }
                }
            } catch {
                // Loading a saved keyword is best-effort.
            }
        }
        void load()
    }, [pageId, focusKeyword, onKeywordLoad, triggerKeywordAnalysis])

    const handleSaveKeyword = async () => {
        const value = editedKeyword.trim()
        if (!value) return
        setIsSavingKeyword(true)
        try {
            await PageDataService.updateCoreData(pageId, {
                focusKeyword: value,
            })

            // Use onKeywordLoad to preserve current tab selection
            onKeywordLoad(value)
            if (triggerKeywordAnalysis) await triggerKeywordAnalysis(value)
        } catch {
            // Saving failed; the user can retry.
        } finally {
            setIsSavingKeyword(false)
        }
    }

    return (
        <div className="optimization-section">
            <StatusBadge status={status} description={description} />

            <div className="field-group">
                <div className="field-label-group">
                    <label className="field-label">Main Keyword</label>
                    <div className="field-char-count">
                        {editedKeyword.length > 60 ? (
                            <span>{editedKeyword.length}/60 (too long - max 60 chars)</span>
                        ) : editedKeyword.length < 3 ? (
                            <span>{editedKeyword.length}/60 (too short - min 3 chars)</span>
                        ) : (
                            <span>{editedKeyword.length}/60 chars</span>
                        )}
                    </div>
                </div>
                <div className="field-input-group">
                    <textarea
                        value={editedKeyword}
                        placeholder="Enter Main Keyword for the page"
                        className="field-input"
                        onChange={e => {
                            setEditedKeyword(e.target.value)
                        }}
                        rows={2}
                    />
                    <button
                        className="save-button"
                        onClick={() => void handleSaveKeyword()}
                        disabled={isSavingKeyword || !editedKeyword.trim()}
                    >
                        {isSavingKeyword ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>

            {ai && (
                <div className="ai-section">
                    <button
                        className="ai-generate-button"
                        onClick={() => {
                            void ai.generate("keyword").catch((error: unknown) => {
                                console.error("Error generating keyword:", error)
                            })
                        }}
                        disabled={ai.generating.keyword}
                    >
                        <MagicWandIcon />
                        {ai.generating.keyword ? "Generating..." : "Generate new Main Keyword"}
                    </button>
                </div>
            )}

            {ai?.generating.keyword ? (
                <div className="ai-suggestions">
                    <label className="field-label">AI Suggestions</label>
                    {[1, 2, 3].map(index => (
                        <div key={index} className="ai-suggestion-card shimmer">
                            <div className="ai-suggestion-content">
                                <div className="shimmer-icon"></div>
                                <div className="shimmer-text"></div>
                            </div>
                            <div className="ai-suggestion-actions">
                                <div className="shimmer-button"></div>
                                <div className="shimmer-button"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : ai?.suggestions.keyword && ai.suggestions.keyword.length > 0 ? (
                <div className="ai-suggestions">
                    <label className="field-label">AI Suggestions</label>
                    {ai.suggestions.keyword.map((suggestion, index) => (
                        <div key={index} className="ai-suggestion-card">
                            <div className="ai-suggestion-content">
                                <SparklesIcon />
                                <div className="ai-suggestion-text">{suggestion}</div>
                            </div>
                            <div className="ai-suggestion-actions">
                                <button
                                    className="ai-suggestion-action-button"
                                    onClick={() => {
                                        void navigator.clipboard.writeText(suggestion)
                                    }}
                                >
                                    Copy
                                </button>
                                <button
                                    className="ai-suggestion-action-button primary"
                                    onClick={() => {
                                        void (async () => {
                                            setEditedKeyword(suggestion)
                                            setIsSavingKeyword(true)
                                            try {
                                                await PageDataService.updateCoreData(pageId, {
                                                    focusKeyword: suggestion,
                                                })
                                                onKeywordLoad(suggestion)
                                                if (triggerKeywordAnalysis) await triggerKeywordAnalysis(suggestion)
                                            } catch (err) {
                                                console.error("Error saving keyword:", err)
                                            } finally {
                                                setIsSavingKeyword(false)
                                            }
                                        })()
                                    }}
                                    disabled={isSavingKeyword}
                                >
                                    {isSavingKeyword ? "Saving..." : "Save & Analyze"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}

            {ai?.error && (
                <div className="ai-error">
                    <span>Error: {ai.error}</span>
                    <button onClick={ai.clearError}>Dismiss</button>
                </div>
            )}

            <label className="field-label">Learn</label>
            <Accordion
                key="what-is-main-keyword"
                title="What is Main Keyword?"
                icon={<HelpIcon className="help-icon" />}
            >
                <ul>
                    <li>The primary search phrase you want this page to rank for in Google</li>
                    <li>Guides how you write the Title, Meta Description, H1</li>
                    <li>Chosen by you (designer or site owner), not by Google</li>
                </ul>
            </Accordion>

            <Accordion
                key="good-vs-bad-keyword"
                title="Good vs Bad Main Keyword"
                icon={<GoodVsBadIcon className="good-vs-bad-icon" />}
            >
                <div className="good-pill-group">
                    <div className="good-pill">Good</div>
                </div>
                <ul>
                    <li>
                        Landing page:
                        <span className="good-pill-example">CRM tool for small businesses</span>
                    </li>
                    <li>
                        Product page:
                        <span className="good-pill-example">Team collaboration platform features</span>
                    </li>
                    <li>
                        Service page:
                        <span className="good-pill-example">Cloud migration consulting services</span>
                    </li>
                    <li>
                        Blog post:
                        <span className="good-pill-example">How to improve customer support with AI</span>
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
                        Too Vague:
                        <span className="bad-pill-example">software</span>
                        <span className="bad-pill-example">Services</span>
                        <span className="bad-pill-example">Blog</span>
                    </li>
                    <li>
                        Too broad / competitive:
                        <span className="bad-pill-example">AI</span>
                        <span className="bad-pill-example">Marketing</span>
                        <span className="bad-pill-example">Finance</span>
                    </li>
                    <li>
                        Mismatch → Product page about invoicing software, but <br />
                        <span className="bad-pill-example"> keyword = project management tool</span>
                    </li>
                    <li>
                        Keyword stuffing:
                        <span className="bad-pill-example">Best cheap affordable AI SaaS CRM download</span>
                    </li>
                    <li>
                        Duplicate: Two pages in same site both targeting the same keyword
                        <span className="bad-pill-example">AI writing software pricing</span>
                    </li>
                </ul>
            </Accordion>

            <Accordion
                key="how-to-set-keyword"
                title="How to set Main Keyword?"
                icon={<HelpIcon className="help-icon" />}
            >
                <ul>
                    <li>Enter the keyword in the input box above that best matches the page's intent.</li>
                    <li>Click Save</li>
                </ul>
            </Accordion>
        </div>
    )
}
