interface ErrorMessageProps {
    errorMessage: string
    onRetryButtonClick: (() => void) | undefined
}

export function ErrorMessage({ errorMessage, onRetryButtonClick }: ErrorMessageProps) {
    return (
        <div className="h-full w-full flex flex-col items-center justify-center">
            <h2 className="mb-2 text-framer-text-primary font-semibold max-w-48">Cannot Load Data</h2>
            <p className="mb-3 text-framer-text-secondary font-medium max-w-48">{errorMessage}</p>
            {onRetryButtonClick && (
                <button
                    onClick={onRetryButtonClick}
                    className="w-min px-2 py-[8px] rounded-lg bg-tint text-framer-text-primary font-medium hover:bg-framer-button-hover-light dark:hover:bg-framer-button-hover-dark text-xs"
                >
                    Reload
                </button>
            )}
        </div>
    )
}
