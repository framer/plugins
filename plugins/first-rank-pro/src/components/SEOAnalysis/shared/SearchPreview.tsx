import "../styles.css"
import { UnoptimizedIcon } from "../../../assets/icons"

interface SearchPreviewProps {
    pageName: string
    title: string
    description: string
}

export function SearchPreview({ pageName, title, description }: SearchPreviewProps) {
    const titleIsFail = !title || title.toLowerCase() === pageName.toLowerCase()
    const descIsFail = !description

    return (
        <div className="search-preview">
            <label className="field-label">Preview - Search Result</label>
            <div className="serp-preview">
                <div className="serp-url">{`your-website.com/${pageName}`}</div>
                <div className={`serp-title ${titleIsFail ? "fail" : ""}`}>
                    {titleIsFail && <UnoptimizedIcon />}
                    {title ? title.charAt(0).toUpperCase() + title.slice(1) : "Page Title"}
                </div>
                <div className={`serp-description ${descIsFail ? "fail" : ""}`}>
                    {descIsFail && <UnoptimizedIcon />}
                    {description || "Page Description"}
                </div>
            </div>
        </div>
    )
}
