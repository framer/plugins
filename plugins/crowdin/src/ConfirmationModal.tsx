import { useState } from "react"

interface ConfirmationModalProps {
    localeName: string
    currentStep: number
    totalSteps: number
    remainingLocaleCount: number
    skip: () => void
    update: () => void
    updateAll: () => void
}

export function ConfirmationModal({
    localeName,
    currentStep,
    totalSteps,
    remainingLocaleCount,
    skip,
    update,
    updateAll,
}: ConfirmationModalProps) {
    const [allChecked, setAllChecked] = useState(false)

    return (
        <main>
            <hr />
            <div className="heading">
                <h1>Import Locale{totalSteps === 1 ? "" : "s"}</h1>
                <span className="step-indicator">
                    {currentStep} / {totalSteps}
                </span>
            </div>
            <hr />
            <p>
                By importing you are going to modify the existing locale <strong>“{localeName}”</strong>.
            </p>
            {totalSteps > 1 && (
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={e => {
                            setAllChecked(e.target.checked)
                        }}
                    />
                    <p>
                        All ({remainingLocaleCount} {remainingLocaleCount === 1 ? "locale" : "locales"})
                    </p>
                </label>
            )}
            <div className="button-row">
                <button onClick={skip}>Skip</button>
                <button onClick={allChecked ? updateAll : update} className="framer-button-primary">
                    Update
                </button>
            </div>
        </main>
    )
}
