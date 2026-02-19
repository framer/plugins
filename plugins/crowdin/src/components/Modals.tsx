import { useState } from "react"

interface ModalProps {
    title: string
    currentStep?: number
    totalSteps?: number
    description: React.ReactNode
    content?: React.ReactNode
    primaryButtonText: string
    onSkipClick: () => void
    onPrimaryClick: () => void
}

interface ConfirmationModalProps {
    localeName: string
    currentStep: number
    totalSteps: number
    remainingLocaleCount: number
    /** Count of remaining locales that already exist in Framer (not new). Used to show "All" checkbox only when > 1. */
    remainingExistingLocaleCount: number
    skip: () => void
    update: () => void
    updateAll: () => void
}

interface CreateLocaleModalProps {
    localeCode: string
    currentStep?: number
    totalSteps?: number
    onSkip: () => void
    onAdd: () => void
}

export function ConfirmationModal({
    localeName,
    currentStep,
    totalSteps,
    remainingLocaleCount,
    remainingExistingLocaleCount,
    skip,
    update,
    updateAll,
}: ConfirmationModalProps) {
    const [allChecked, setAllChecked] = useState(false)

    return (
        <Modal
            title={`Import Locale${totalSteps === 1 ? "" : "s"}`}
            currentStep={currentStep}
            totalSteps={totalSteps}
            description={
                <>
                    By importing you are going to modify the existing locale <strong>"{localeName}"</strong>.
                </>
            }
            content={
                remainingExistingLocaleCount > 1 ? (
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
                ) : undefined
            }
            primaryButtonText="Update"
            onSkipClick={skip}
            onPrimaryClick={allChecked ? updateAll : update}
        />
    )
}

export function CreateLocaleModal({ localeCode, currentStep, totalSteps, onSkip, onAdd }: CreateLocaleModalProps) {
    return (
        <Modal
            title="Add Locale"
            currentStep={currentStep}
            totalSteps={totalSteps}
            description={
                <>
                    No locale with code <strong>"{localeCode}"</strong> found.
                    <br />
                    Add a new one or skip this locale.
                </>
            }
            primaryButtonText="Add"
            onSkipClick={onSkip}
            onPrimaryClick={onAdd}
        />
    )
}

export function Modal({
    title,
    currentStep,
    totalSteps,
    description,
    content,
    primaryButtonText,
    onSkipClick,
    onPrimaryClick,
}: ModalProps) {
    const showStepIndicator = currentStep != null && totalSteps != null && totalSteps > 1

    return (
        <main>
            <hr />
            <div className="heading">
                <h1>{title}</h1>
                {showStepIndicator && (
                    <span className="step-indicator">
                        {currentStep} / {totalSteps}
                    </span>
                )}
            </div>
            <hr />
            <p>{description}</p>
            {content}
            <div className="button-row">
                <button onClick={onSkipClick}>Skip</button>
                <button onClick={onPrimaryClick} className="framer-button-primary">
                    {primaryButtonText}
                </button>
            </div>
        </main>
    )
}
