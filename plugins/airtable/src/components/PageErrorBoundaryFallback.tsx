import { PropsWithChildren } from "react"
import { QueryErrorResetBoundary } from "@tanstack/react-query"
import { ErrorBoundary } from "react-error-boundary"

export const PageErrorBoundaryFallback = ({ children }: PropsWithChildren) => (
    <QueryErrorResetBoundary>
        {({ reset }) => (
            <ErrorBoundary
                onReset={reset}
                fallbackRender={({ resetErrorBoundary, error }) => (
                    <div className="flex flex-col w-full h-full gap-2 items-center justify-center">
                        <p className="text-framer-red w-full line-clamp-6">{error.message}</p>
                        <button className="w-full" onClick={resetErrorBoundary}>
                            Try again
                        </button>
                    </div>
                )}
            >
                {children}
            </ErrorBoundary>
        )}
    </QueryErrorResetBoundary>
)
