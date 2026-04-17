import { type ConflictSummary, type PendingDelete, shortProjectHash } from "@code-link/shared"
import { framer } from "framer-plugin"
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react"
import { CodeFilesAPI } from "./api"
import { initialState, type UiState, reducer } from "./app-state"
import { createMessageHandler } from "./messages"
import { copyToClipboard } from "./utils/clipboard"
import { computeLineDiff } from "./utils/diffing"
import * as log from "./utils/logger"
import { createSocketConnectionController } from "./utils/sockets"
import { useConstant } from "./utils/useConstant"

export function App() {
    const [state, dispatch] = useReducer(reducer, initialState)
    const socketRef = useRef<WebSocket | null>(null)
    const api = useConstant<CodeFilesAPI>(() => new CodeFilesAPI())

    const command = state.project && `npx framer-code-link ${shortProjectHash(state.project.id)}`

    useLayoutEffect(() => {
        switch (state.ui.kind) {
            case "deletePrompt":
                if (state.ui.deletes.length === 1) {
                    void framer.showUI({
                        width: 260,
                        height: 187,
                        position: "center",
                        resizable: false,
                    })
                } else {
                    void framer.showUI({
                        width: 320,
                        height: 420,
                        position: "center",
                        resizable: "width",
                    })
                }
                break
            case "conflictPrompt":
                void framer.showUI({
                    width: 320,
                    height: 420,
                    position: "center",
                    resizable: "width",
                })
                break
            case "info":
                void framer.showUI({
                    width: 260,
                    height: 360,
                    position: "center",
                    resizable: false,
                })
                break
            case "replaced":
                break
            default:
                void framer.setBackgroundMessage(backgroundStatusFromUi(state.ui))
                void framer.hideUI()
        }
    }, [state.ui])

    const replacedClosedRef = useRef(false)
    useEffect(() => {
        if (state.ui.kind === "replaced" && !replacedClosedRef.current) {
            replacedClosedRef.current = true
            void framer.closePlugin("Replaced by another Plugin connection", {
                variant: "info",
            })
        }
    }, [state.ui.kind])

    // Permissions check
    useEffect(() => {
        let unsubscribePermissions: (() => void) | undefined

        async function checkPermissions() {
            log.debug("Bootstrapping plugin...")
            const project = await framer.getProjectInfo()
            log.debug("Project loaded:", project)
            dispatch({ type: "project-loaded", project })

            // Check initial permission state
            const initialPermissions = framer.isAllowedTo(
                "createCodeFile",
                "CodeFile.rename",
                "CodeFile.setFileContent",
                "CodeFile.remove"
            )
            log.debug("Initial permissions:", initialPermissions)
            dispatch({ type: "permissions-updated", granted: initialPermissions })

            // Subscribe to permission changes
            unsubscribePermissions = framer.subscribeToIsAllowedTo(
                "createCodeFile",
                "CodeFile.rename",
                "CodeFile.setFileContent",
                "CodeFile.remove",
                granted => {
                    log.debug("Permissions changed:", granted)
                    dispatch({ type: "permissions-updated", granted })
                }
            )
        }

        void checkPermissions()
        return () => unsubscribePermissions?.()
    }, [])

    // Code file subscription
    useEffect(() => {
        if (!state.project || !state.permissionsGranted) return

        const unsubscribeCodeFiles = framer.subscribeToCodeFiles(() => {
            log.debug("Framer files changed")
            const socket = socketRef.current
            if (socket && socket.readyState === WebSocket.OPEN) {
                void api.handleFramerFilesChanged(socket)
            }
        })

        return () => {
            unsubscribeCodeFiles()
        }
    }, [state.project, state.permissionsGranted, api])

    // Socket connection
    useEffect(() => {
        if (!state.project || !state.permissionsGranted) {
            log.debug("Waiting for project/permissions:", {
                project: !!state.project,
                permissions: state.permissionsGranted,
            })
            return
        }

        const setSocket = (socket: WebSocket | null) => {
            socketRef.current = socket
        }

        const handleDisconnected = (message: string) => {
            dispatch({ type: "socket-disconnected", message })
        }
        const handleConnected = () => {
            dispatch({ type: "socket-connected" })
        }
        const handleReplaced = () => {
            dispatch({ type: "socket-replaced" })
        }

        const handleMessage = createMessageHandler({ dispatch, api })
        const controller = createSocketConnectionController({
            project: state.project,
            setSocket,
            onMessage: handleMessage,
            onConnected: handleConnected,
            onDisconnected: handleDisconnected,
            onReplaced: handleReplaced,
        })
        controller.start()

        return () => {
            log.debug("Cleaning up socket connection")
            controller.stop()
        }
    }, [state.project, state.permissionsGranted, api])

    const sendMessage = useCallback((payload: unknown) => {
        const socket = socketRef.current
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(payload))
        }
    }, [])

    const resolveConflicts = (choice: "local" | "remote") => {
        if (state.ui.kind !== "conflictPrompt") {
            return
        }
        sendMessage({
            type: "conflicts-resolved",
            resolution: choice,
            session: state.ui.session,
            fileNames: state.ui.conflicts.map(c => c.fileName),
        })
        dispatch({ type: "clear-conflicts" })
    }

    const confirmDeletes = () => {
        if (state.ui.kind !== "deletePrompt" || state.ui.deletes.length === 0) {
            return
        }

        sendMessage({
            type: "delete-confirmed",
            fileNames: state.ui.deletes.map(file => file.fileName),
            session: state.ui.session,
        })
        dispatch({ type: "clear-pending-deletes" })
    }

    const keepDeletes = () => {
        if (state.ui.kind !== "deletePrompt" || state.ui.deletes.length === 0) {
            return
        }

        sendMessage({
            type: "delete-cancelled",
            files: state.ui.deletes,
            session: state.ui.session,
        })
        dispatch({ type: "clear-pending-deletes" })
    }

    switch (state.ui.kind) {
        case "deletePrompt":
            return <DeletePanel files={state.ui.deletes} onConfirm={confirmDeletes} onKeep={keepDeletes} />

        case "conflictPrompt":
            return <ConflictPanel conflicts={state.ui.conflicts} onResolve={resolveConflicts} />

        case "info":
            return <InfoPanel command={command} />

        case "replaced":
            return null
        default:
            return null
    }
}

function backgroundStatusFromUi(ui: UiState): string | null {
    switch (ui.kind) {
        case "loading":
            return "Loading…"
        case "info":
            return null
        case "syncing":
            return "Syncing…"
        case "deletePrompt":
            return null
        case "conflictPrompt":
            return null
        case "idle":
            return "Watching Files…"
        case "error":
            return null
        case "replaced":
            return null
        default:
            return "Loading…"
    }
}

interface InfoPanelProps {
    command: string | undefined
}

type CopyState = "initial" | "copied" | "returning"

function InfoPanel({ command }: InfoPanelProps) {
    const [copyState, setCopyState] = useState<CopyState>("initial")
    const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    const handleCopy = async () => {
        if (copyTimeout.current) clearTimeout(copyTimeout.current)
        if (!command) return

        try {
            await copyToClipboard(command)
            setCopyState("copied")
            copyTimeout.current = setTimeout(() => {
                setCopyState("returning")
            }, 2000)
        } catch {
            // Don't animate when failing
        }
    }

    return (
        <main>
            <div className="info">
                <div className="plugin-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="none" viewBox="0 0 30 30">
                        <path
                            d="M 9.792 7.898 C 9.671 7.733 9.789 7.5 9.993 7.5 L 17.232 7.5 C 17.4 7.5 17.556 7.584 17.648 7.723 L 22.241 14.611 C 22.352 14.777 22.233 15 22.033 15 L 15 15 Z"
                            fill="currentColor"
                        />
                        <path
                            d="M 7.759 15.389 C 7.648 15.223 7.767 15 7.967 15 L 15 15 L 20.208 22.102 C 20.329 22.267 20.211 22.5 20.007 22.5 L 12.768 22.5 C 12.6 22.5 12.444 22.416 12.352 22.277 Z"
                            fill="currentColor"
                        />
                    </svg>
                </div>
                <h1>Sync your Code Files</h1>
                <p>
                    Run the command locally in your terminal to get started.{" "}
                    <a
                        href="https://github.com/framer/plugins/tree/main/plugins/code-link"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Learn More
                    </a>
                </p>
            </div>
            <div className="command-container">
                <div className="command-block">
                    {/* <div className="mask"></div> */}
                    <pre>{command}</pre>
                </div>
                <button className="framer-button-primary copy-button" onClick={() => void handleCopy()}>
                    {copyState === "copied" ? (
                        <>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                viewBox="0 0 12 12"
                                style={{ marginRight: 2, marginLeft: -2 }}
                            >
                                <path
                                    className="checkmark-path"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M2.5 6.5l2.5 2.5 5-5.5"
                                />
                            </svg>
                            <span className="copy-label-animate">Copied</span>
                        </>
                    ) : (
                        <span className={copyState === "returning" ? "copy-label-animate" : ""}>Copy</span>
                    )}
                </button>
            </div>
        </main>
    )
}

interface DeletePanelProps {
    files: PendingDelete[]
    onConfirm: () => void
    onKeep: () => void
}

function DeletePanel({ files, onConfirm, onKeep }: DeletePanelProps) {
    const multiple = files.length > 1
    const text = multiple
        ? {
              title: "Confirm Deletions",
              description:
                  "The following code files were deleted locally and will be permanently removed from this Project.",
          }
        : {
              title: "Confirm Deletion",
              description: "Code file was deleted locally and will be permanently removed from this Project.",
          }

    const lines = files.map(file => file.content?.split("\n").length ?? 0)

    if (files.length === 0 || files[0] === undefined) return null

    return (
        <main className="user-action-view delete-confirmation">
            <div className="framer-divider" />
            <header>
                <h1>{text.title}</h1>
                <p>{text.description}</p>
            </header>
            {multiple ? (
                <>
                    <div className="list-header">
                        <div className="framer-divider" />
                        <div className="list-titles">
                            <div>File</div>
                            <div>Lines</div>
                        </div>
                        <div className="framer-divider" />
                    </div>
                    <ul className="list">
                        {files.map((file, index) => (
                            <li key={file.fileName}>
                                <div className="file-name">{file.fileName}</div>
                                <div className="lines-changed">
                                    <span className="line-badge removed">-{lines[index]}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </>
            ) : (
                <div className="single-file-view">
                    <div className="file-name">{files[0].fileName}</div>
                    <div className="lines-changed">
                        <span className="line-badge removed">-{lines[0]}</span>
                    </div>
                </div>
            )}

            <div className="framer-divider" />
            <div className="actions">
                <button onClick={onKeep}>Undo</button>
                <button className="framer-button-primary destructive-button" onClick={onConfirm}>
                    Delete {multiple ? "All" : ""}
                </button>
            </div>
        </main>
    )
}

interface ConflictPanelProps {
    conflicts: ConflictSummary[]
    onResolve: (choice: "local" | "remote") => void
}

function ConflictPanel({ conflicts, onResolve }: ConflictPanelProps) {
    return (
        <main className="user-action-view">
            <div className="framer-divider" />
            <header>
                <h1>Resolve Conflicts</h1>
                <p>The following code files have changed in Framer and locally. Select which set of changes to keep.</p>
            </header>
            <div className="list-header">
                <div className="framer-divider" />
                <div className="list-titles">
                    <div>File</div>
                    <div>Local</div>
                    <div>Framer</div>
                </div>
                <div className="framer-divider" />
            </div>
            <ul className="list">
                {conflicts.map(conflict => {
                    // Show unique lines on each side
                    const diff =
                        conflict.localContent !== null && conflict.remoteContent !== null
                            ? computeLineDiff(conflict.remoteContent, conflict.localContent)
                            : null

                    // diff.added = lines only in local
                    // diff.removed = lines only in remote

                    const LocalBadge = () => {
                        if (conflict.localContent === null) {
                            return <span className="line-badge removed">deleted</span>
                        }
                        if (!diff || diff.added === 0) {
                            return <span className="line-badge unchanged">±0</span>
                        }
                        return <span className="line-badge added">+{diff.added}</span>
                    }

                    const FramerBadge = () => {
                        if (conflict.remoteContent === null) {
                            return <span className="line-badge removed">deleted</span>
                        }
                        if (!diff || diff.removed === 0) {
                            return <span className="line-badge unchanged">±0</span>
                        }
                        return <span className="line-badge added">+{diff.removed}</span>
                    }

                    return (
                        <li key={conflict.fileName}>
                            <div className="file-name">{conflict.fileName}</div>
                            <div className="lines-changed">
                                <LocalBadge />
                            </div>
                            <div className="lines-changed">
                                <FramerBadge />
                            </div>
                        </li>
                    )
                })}
            </ul>
            <div className="framer-divider" />
            <div className="actions">
                <button
                    onClick={() => {
                        onResolve("local")
                    }}
                >
                    Keep Local
                </button>
                <button
                    className="framer-button-primary"
                    onClick={() => {
                        onResolve("remote")
                    }}
                >
                    Keep Framer
                </button>
            </div>
        </main>
    )
}
