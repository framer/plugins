import { QueryErrorResetBoundary } from "@tanstack/react-query"
import { framer } from "framer-plugin"
import type { PropsWithChildren } from "react"
import { ErrorBoundary } from "react-error-boundary"
import * as v from "valibot"
import auth from "../auth"
import { PluginError } from "../PluginError"

const ErrorSchema = v.object({ message: v.string() })

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
                                    {v.is(ErrorSchema, error) ? error.message : "Unknown error"}
                                    <br />
                                    <br />
                                    Please retry or{" "}
                                    <a
                                        href="#"
                                        className="text-framer-blue"
                                        onClick={e => {
                                            e.preventDefault()
                                            auth.logout()
                                            void framer.closePlugin()
                                        }}
                                    >
                                        log out
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
