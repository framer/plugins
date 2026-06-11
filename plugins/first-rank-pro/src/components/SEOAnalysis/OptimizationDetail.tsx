import { useState } from "react"
import type { UseAIGenerationReturn } from "../../hooks/useAIGeneration"
import type { ExtractedSEOData, SEOCheck } from "../../types/seo"
import "./styles.css"
import { ContentSection } from "./sections/ContentSection"
import { FocusKeywordSection } from "./sections/FocusKeywordSection"
import { H1Section } from "./sections/H1Section"
import { HeadingHierarchySection } from "./sections/HeadingHierarchySection"
import { ImageAltSection } from "./sections/ImageAltSection"
import { KeywordPlacementSection } from "./sections/KeywordPlacementSection"
import { MetaDescriptionSection } from "./sections/MetaDescriptionSection"
import { TitleSection } from "./sections/TitleSection"

interface OptimizationDetailProps {
    check: SEOCheck
    focusKeyword: string
    onFocusKeywordChange: (keyword: string) => void
    onKeywordLoad: (keyword: string) => void
    extractedData: ExtractedSEOData
    triggerKeywordAnalysis?: (keyword: string) => Promise<void>
    pageId: string
    ai?: UseAIGenerationReturn
}

export function OptimizationDetail({
    check,
    focusKeyword,
    onFocusKeywordChange,
    onKeywordLoad,
    extractedData,
    triggerKeywordAnalysis,
    pageId,
    ai,
}: OptimizationDetailProps) {
    function getPageName(url: string): string {
        const { pathname } = new URL(url)
        return pathname === "/" ? "home" : pathname.slice(1)
    }

    const [pageName] = useState(getPageName(extractedData.url))
    const [editedTitle] = useState(extractedData.title)
    const [editedMeta] = useState(extractedData.metaDescription)
    const [editedH1] = useState(() => {
        const h1 = extractedData.headings.find(h => h.level === "h1")
        return h1 ? h1.text : ""
    })

    const renderSection = () => {
        // Check for keyword-placement
        if (check.id === "keyword-placement") {
            return (
                <KeywordPlacementSection
                    status={check.status}
                    description={check.description}
                    evidence={check.evidence}
                    keyword={focusKeyword}
                />
            )
        }

        if (check.id === "main-keyword") {
            return (
                <FocusKeywordSection
                    status={check.status}
                    description={check.description}
                    pageId={pageId}
                    focusKeyword={focusKeyword}
                    onFocusKeywordChange={onFocusKeywordChange}
                    onKeywordLoad={onKeywordLoad}
                    triggerKeywordAnalysis={triggerKeywordAnalysis}
                    ai={ai}
                />
            )
        }

        if (check.id === "page-title") {
            return (
                <TitleSection
                    status={check.status}
                    description={check.description}
                    pageName={pageName}
                    title={editedTitle}
                    metaDescription={editedMeta || extractedData.metaDescription}
                    ai={ai}
                />
            )
        }

        if (check.id === "page-description") {
            return (
                <MetaDescriptionSection
                    status={check.status}
                    description={check.description}
                    pageName={pageName}
                    title={editedTitle}
                    metaDescription={editedMeta || extractedData.metaDescription}
                    ai={ai}
                />
            )
        }

        if (check.id === "h1-check") {
            return (
                <H1Section
                    status={check.status}
                    description={check.description}
                    headings={extractedData.headings}
                    h1Text={editedH1}
                    ai={ai}
                />
            )
        }

        if (check.id === "hierarchy-check") {
            return (
                <HeadingHierarchySection
                    status={check.status}
                    description={check.description}
                    headings={extractedData.headings}
                />
            )
        }

        if (check.id === "image-alts") {
            return (
                <ImageAltSection
                    status={check.status}
                    description={check.description}
                    evidence={check.evidence}
                    images={extractedData.images}
                />
            )
        }

        if (check.id === "content-length") {
            return <ContentSection status={check.status} description={check.description} />
        }

        return (
            <div className="optimization-section">
                <h3>{check.name}</h3>
                <p>{check.description}</p>
            </div>
        )
    }

    return <div className="optimization-detail">{renderSection()}</div>
}
