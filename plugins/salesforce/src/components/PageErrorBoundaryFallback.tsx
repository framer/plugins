import { PropsWithChildren } from "react"
import { framer } from "framer-plugin"
import { ErrorBoundary } from "react-error-boundary"
import { QueryErrorResetBoundary } from "@tanstack/react-query"
import { PluginError } from "../PluginError"
import auth from "@/auth"
import { Message } from "./Message"

export const PageErrorBoundaryFallback = ({ children }: PropsWithChildren) => (
    <QueryErrorResetBoundary>
        {({ reset }) => (
            <ErrorBoundary
                onReset={reset}
                fallbackRender={({ resetErrorBoundary, error }) => {
                    return (
                        <div className="flex flex-col h-full">
                            <div className="flex-grow overflow-y-auto px-[15px]">
                                <Message title={(error instanceof PluginError && error.title) || ""}>
                                    {error.message}
                                    <br />
                                    <br />
                                    Please retry or{" "}
                                    <a
                                        href="#"
                                        className="text-framer-blue"
                                        onClick={async e => {
                                            e.preventDefault()
                                            auth.logout()
                                                .then(() => framer.closePlugin())
                                                .catch(e =>
                                                    framer.notify(e instanceof Error ? e.message : JSON.stringify(e))
                                                )
                                        }}
                                    >
                                        logout
                                    </a>
                                    .
                                </Message>
                            </div>
                            <div className="sticky bottom-0 left-0 p-[15px]">
                                <hr className="mb-[15px]" />
                                <button className="w-full" onClick={resetErrorBoundary}>
                                    Retry
                                </button>
                            </div>
                        </div>
                    )
                }}
            >
                {children}
            </ErrorBoundary>
        )}
    </QueryErrorResetBoundary>
)
