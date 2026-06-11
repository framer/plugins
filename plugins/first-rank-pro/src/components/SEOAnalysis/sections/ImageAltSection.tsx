import { GoodVsBadIcon, HelpIcon } from "../../../assets/icons"
import type { SEOImage } from "../../../types/seo"
import { Accordion } from "../../common/Accordion"
import { ImageTable } from "../ImageTable"
import { StatusBadge } from "../shared/StatusBadge"
import "../styles.css"

interface ImageAltSectionProps {
    status: string
    description: string
    evidence: string
    images: SEOImage[]
}

export function ImageAltSection({ status, description, evidence, images }: ImageAltSectionProps) {
    // Parse evidence to get image statistics
    const stats = (() => {
        try {
            return JSON.parse(evidence) as { total?: number; withAlt?: number; withoutAlt?: number }
        } catch {
            return { total: 0, withAlt: 0, withoutAlt: 0 }
        }
    })()
    const total = stats.total ?? 0
    const withAlt = stats.withAlt ?? 0
    const withoutAlt = stats.withoutAlt ?? 0

    return (
        <div className="optimization-section">
            <StatusBadge status={status} description={description} />

            {/* Statistics Display */}
            <div className="field-group">
                <label className="field-label">Image Statistics</label>
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
            </div>

            {/* Image Details Table */}
            <div className="field-group">
                <label className="field-label">All Images</label>
                <ImageTable images={images} />
            </div>

            <label className="field-label">Learn</label>
            <Accordion title="Why Image Alt Text matters?" icon={<HelpIcon className="help-icon" />}>
                <ul>
                    <li>Screen readers use alt text to describe images to visually impaired users</li>
                    <li>Search engines rely on alt text to understand image content</li>
                    <li>Alt text appears when images fail to load</li>
                    <li>Improves overall page accessibility and SEO</li>
                </ul>
            </Accordion>

            <Accordion title="Good vs Bad Alt Text" icon={<GoodVsBadIcon className="good-vs-bad-icon" />}>
                <div className="good-pill-group">
                    <div className="good-pill">Good</div>
                </div>
                <ul>
                    <li>
                        For a product image:
                        <span className="good-pill-example">Blue running shoes with white sole</span>
                    </li>
                    <li>
                        For an infographic:
                        <span className="good-pill-example">
                            Chart showing website traffic growth from January to December
                        </span>
                    </li>
                    <li>
                        For a team photo:
                        <span className="good-pill-example">Marketing team celebrating product launch</span>
                    </li>
                    <li>
                        For decorative images:
                        <span className="good-pill-example">Leave alt text empty (alt="")</span>
                    </li>
                </ul>
                <span className="field-label">Why is it good?</span>
                <ul>
                    <li>Descriptive and specific about what the image shows</li>
                    <li>Concise (usually under 125 characters)</li>
                    <li>Natural language that makes sense when read aloud</li>
                    <li>Includes relevant keywords when appropriate</li>
                </ul>

                <div className="bad-pill-group">
                    <div className="bad-pill">Bad</div>
                </div>
                <ul>
                    <li>
                        Too generic:
                        <span className="bad-pill-example">image</span>
                        <span className="bad-pill-example">photo</span>
                        <span className="bad-pill-example">picture</span>
                    </li>
                    <li>
                        Keyword stuffing:
                        <span className="bad-pill-example">buy shoes running shoes best shoes cheap shoes online</span>
                    </li>
                    <li>
                        Too verbose:
                        <span className="bad-pill-example">
                            This is a photograph taken at our office showing our team members standing together...
                        </span>
                    </li>
                    <li>
                        Filename as alt:
                        <span className="bad-pill-example">IMG_20231015_0542.jpg</span>
                    </li>
                </ul>
            </Accordion>

            <Accordion title="How to add Alt Text in Framer?" icon={<HelpIcon className="help-icon" />}>
                <ul>
                    <li>Select the image in your Framer canvas</li>
                    <li>Look for the "Alt Text" field in the right sidebar properties panel</li>
                    <li>Enter a descriptive alt text for the image</li>
                    <li>For decorative images, leave the field empty or use an empty string</li>
                    <li>Publish your changes to see them reflected in SEO analysis</li>
                </ul>
            </Accordion>
        </div>
    )
}
