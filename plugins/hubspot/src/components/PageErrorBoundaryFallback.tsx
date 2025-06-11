import { QueryErrorResetBoundary } from "@tanstack/react-query"
import { framer } from "framer-plugin"
import type { PropsWithChildren } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { PluginError } from "../PluginError"
import auth from "../auth"

export const PageErrorBoundaryFallback = ({ children }: PropsWithChildren) => (
    <QueryErrorResetBoundary>
        {({ reset }) => (
            <ErrorBoundary
                onReset={reset}
                fallbackRender={({ resetErrorBoundary, error }) => {
                    return (
                        <main>
                            <div className="col items-center m-auto">
                                <h6>{error instanceof PluginError && error.title}</h6>
                                <span className="text-tertiary text-center max-w-[200px]">
                                    {error.message}
                                    <br />
                                    <br />
                                    Please retry or{" "}
                                    <a
                                        href="#"
                                        className="text-framer-blue"
                                        onClick={e => {
                                            e.preventDefault()
                                            auth.logout()
                                            framer.closePlugin()
                                        }}
                                    >
                                        logout
                                    </a>
                                    .
                                </span>
                            </div>
                            <div className="col-lg">
                                <hr />
                                <button className="w-full" onClick={resetErrorBoundary}>
                                    Retry
                                </button>
                            </div>
                        </main>
                    )
                }}
            >
                {children}
            </ErrorBoundary>
        )}
    </QueryErrorResetBoundary>
)
