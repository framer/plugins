import "./styles.css"

interface SEOScoreProps {
    score: number
}

export function SEOScore({ score }: SEOScoreProps) {
    return (
        <div className="score-circle">
            <span className="score">{score}%</span>
        </div>
    )
}
