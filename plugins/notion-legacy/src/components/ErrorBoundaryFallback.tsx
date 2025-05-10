import { QueryErrorResetBoundary } from "@tanstack/react-query"

export function ErrorBoundaryFallback() {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => {
                return (
                    <div className="flex flex-col w-full h-full gap-2 items-center justify-center">
                        <span>Something went wrong...</span>
                        <button onClick={reset}>Try again</button>
                    </div>
                )
            }}
        </QueryErrorResetBoundary>
    )
}
