import { QueryErrorResetBoundary } from "@tanstack/react-query"
import type { PropsWithChildren } from "react"
import { ErrorBoundary } from "react-error-boundary"
import * as v from "valibot"

const ErrorSchema = v.object({ message: v.string() })

export const PageErrorBoundaryFallback = ({ children }: PropsWithChildren) => (
    <QueryErrorResetBoundary>
        {({ reset }) => (
            <ErrorBoundary
                onReset={reset}
                fallbackRender={({ resetErrorBoundary, error }) => (
                    <div className="flex flex-col w-full h-full gap-2 items-center justify-center">
                        <p className="text-framer-red w-full line-clamp-6">
                            {v.is(ErrorSchema, error) ? error.message : "Unknown error"}
                        </p>
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
