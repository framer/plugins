import { PropsWithChildren } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { QueryErrorResetBoundary } from "@tanstack/react-query"

export const PageErrorBoundaryFallback = ({ children }: PropsWithChildren) => (
    <QueryErrorResetBoundary>
        {({ reset }) => (
            <ErrorBoundary
                onReset={reset}
                fallbackRender={({ resetErrorBoundary, error }) => (
                    <>
                        <p className="text-framer-red w-full line-clamp-6">{error.message}</p>
                        <button className="w-full" onClick={resetErrorBoundary}>
                            Try again
                        </button>
                    </>
                )}
            >
                {children}
            </ErrorBoundary>
        )}
    </QueryErrorResetBoundary>
)
