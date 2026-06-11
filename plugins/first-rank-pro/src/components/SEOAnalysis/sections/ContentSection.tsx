import { GoodVsBadIcon, HelpIcon } from "../../../assets/icons"
import { Accordion } from "../../common/Accordion"
import { StatusBadge } from "../shared/StatusBadge"
import "../styles.css"

interface ContentSectionProps {
    status: string
    description: string
}

export function ContentSection({ status, description }: ContentSectionProps) {
    return (
        <div className="optimization-section">
            <StatusBadge status={status} description={description} />

            <label className="field-label">Learn</label>
            <Accordion title="Why Content Length matters?" icon={<HelpIcon className="help-icon" />}>
                <ul>
                    <li>Too little content makes it hard to rank in search</li>
                    <li>Longer, in-depth content builds authority & trust</li>
                    <li>Clear, well-structured text keeps users engaged</li>
                </ul>
            </Accordion>

            <Accordion title="Good vs Bad Content Length" icon={<GoodVsBadIcon className="good-vs-bad-icon" />}>
                <div className="good-pill-group">
                    <div className="good-pill">Good</div>
                    <div className="good-pill-example">1,200 words with clear sections, headings, and examples.</div>
                </div>
                <ul>
                    <li>Explains the page topic in depth</li>
                    <li>Naturally uses keywords while keeping readers engaged</li>
                    <li>Meets recommended length by page type:</li>
                    <ul>
                        <li>Landing page: 1000-1200 words</li>
                        <li>Blog post: 500-1000 words</li>
                        <li>Product page: 200-500 words</li>
                    </ul>
                </ul>
                <div className="bad-pill-group">
                    <div className="bad-pill">Bad</div>
                    <div className="bad-pill-example">100 words of vague, generic content</div>
                </div>
                <ul>
                    <li>Too thin to rank well</li>
                    <li>No real value for readers</li>
                    <li>Misses keyword opportunities</li>
                </ul>
            </Accordion>
        </div>
    )
}
