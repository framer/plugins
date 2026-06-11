import "./styles.css"

export function LoadingSpinner() {
    return (
        <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading...</p>
        </div>
    )
}
