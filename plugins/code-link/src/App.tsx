import {
    type ConflictSummary,
    createSyncTracker,
    getPortFromHash,
    isIncomingMessage,
    type IncomingMessage,
    type Mode,
    type PendingDelete,
    type ProjectInfo,
    type SyncTracker,
    shortProjectHash,
} from "@code-link/shared"
import { framer } from "framer-plugin"
import { useCallback, useEffect, useReducer, useRef, useState } from "react"
import { CodeFilesAPI } from "./api"
import { copyToClipboard } from "./utils/clipboard"
import { computeLineDiff } from "./utils/diffing"
import * as log from "./utils/logger"
import { useConstant } from "./utils/useConstant"

interface State {
    mode: Mode
    project?: ProjectInfo
    permissionsGranted: boolean
    pendingDeletes: PendingDelete[]
    conflicts: ConflictSummary[]
}

type Action =
    | { type: "project-loaded"; project: ProjectInfo }
    | { type: "permissions-updated"; granted: boolean }
    | { type: "set-mode"; mode: Mode }
    | { type: "socket-disconnected"; message: string }
    | { type: "pending-deletes"; files: PendingDelete[] }
    | { type: "clear-pending-deletes" }
    | { type: "conflicts"; conflicts: ConflictSummary[] }
    | { type: "clear-conflicts" }

const initialState: State = {
    mode: "loading",
    permissionsGranted: false,
    pendingDeletes: [],
    conflicts: [],
}

function reducer(state: State, action: Action): State {
    switch (action.type) {
        case "project-loaded":
            return {
                ...state,
                project: action.project,
            }
        case "permissions-updated":
            return {
                ...state,
                permissionsGranted: action.granted,
                mode: action.granted ? state.mode : "info",
            }
        case "set-mode":
            return {
                ...state,
                mode: action.mode,
            }
        case "socket-disconnected":
            return {
                ...state,
                mode: "info",
            }
        case "pending-deletes":
            return {
                ...state,
                pendingDeletes: [...state.pendingDeletes, ...action.files],
                mode: "delete_confirmation",
            }
        case "clear-pending-deletes":
            return { ...state, pendingDeletes: [], mode: "idle" }
        case "conflicts":
            return {
                ...state,
                conflicts: action.conflicts,
                mode: "conflict_resolution",
            }
        case "clear-conflicts":
            return { ...state, conflicts: [], mode: "idle" }
    }
}

export function App() {
    const [state, dispatch] = useReducer(reducer, initialState)
    const socketRef = useRef<WebSocket | null>(null)
    const api = useConstant<CodeFilesAPI>(() => new CodeFilesAPI())
    const syncTracker = useConstant<SyncTracker>(createSyncTracker)
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const connectionAttemptsRef = useRef(0)
    const failureCountRef = useRef(0)

    const command = state.project && `npx framer-code-link ${shortProjectHash(state.project.id)}`

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
                "CodeFile.setFileContent",
                "CodeFile.remove"
            )
            log.debug("Initial permissions:", initialPermissions)
            dispatch({ type: "permissions-updated", granted: initialPermissions })

            // Subscribe to permission changes
            unsubscribePermissions = framer.subscribeToIsAllowedTo(
                "createCodeFile",
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
                void api.handleFramerFilesChanged(socket, syncTracker)
            }
        })

        return () => {
            unsubscribeCodeFiles()
        }
    }, [state.project, state.permissionsGranted, api, syncTracker])

    // Socket connection
    useEffect(() => {
        if (!state.project || !state.permissionsGranted) {
            log.debug("Waiting for project/permissions:", {
                project: !!state.project,
                permissions: state.permissionsGranted,
            })
            return
        }

        // Reset debug counters when project/permissions change
        connectionAttemptsRef.current = 0
        failureCountRef.current = 0

        const handleMessage = createMessageHandler({ dispatch, api, syncTracker })

        let disposed = false

        const clearRetry = () => {
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current)
                retryTimeoutRef.current = null
            }
        }

        const scheduleReconnect = () => {
            if (disposed) return
            clearRetry()
            retryTimeoutRef.current = setTimeout(() => {
                connect()
            }, 2000)
        }

        const connect = () => {
            if (disposed) return
            if (
                socketRef.current?.readyState === WebSocket.OPEN ||
                socketRef.current?.readyState === WebSocket.CONNECTING
            ) {
                log.debug("WebSocket already active – skipping connect")
                return
            }

            if (!state.project) {
                log.debug("Error loading Project Info")
                return
            }

            const port = getPortFromHash(state.project.id)
            const attempt = ++connectionAttemptsRef.current
            const projectName = state.project.name
            const projectShortHash = shortProjectHash(state.project.id)

            log.debug("Opening WebSocket", { port, attempt, project: projectName })
            const socket = new WebSocket(`ws://localhost:${port}`)
            socketRef.current = socket

            const isStale = () => socketRef.current !== socket

            socket.onopen = async () => {
                if (disposed || isStale()) return
                failureCountRef.current = 0
                clearRetry()
                log.debug("WebSocket connected, sending handshake")
                // Don't change mode here - wait for CLI to confirm via request-files
                // This prevents UI flashing during failed handshakes
                const latestProjectInfo = await framer.getProjectInfo()
                log.debug("Project info:", latestProjectInfo)
                socket.send(
                    JSON.stringify({
                        type: "handshake",
                        projectId: latestProjectInfo.id,
                        projectName: latestProjectInfo.name,
                    })
                )
            }

            socket.onmessage = event => {
                if (isStale()) return
                const parsed: unknown = JSON.parse(event.data as string)
                if (!isIncomingMessage(parsed)) {
                    log.warn("Invalid message received:", parsed)
                    return
                }
                log.debug("Received message:", parsed.type)
                void handleMessage(parsed, socket)
            }

            socket.onclose = event => {
                if (disposed || isStale()) return
                socketRef.current = null
                const failureCount = ++failureCountRef.current
                log.debug("WebSocket closed – scheduling reconnect", {
                    code: event.code,
                    reason: event.reason || "none",
                    wasClean: event.wasClean,
                    port,
                    attempt,
                    project: projectName,
                    failureCount,
                })
                dispatch({
                    type: "socket-disconnected",
                    message: `Cannot reach CLI for ${projectName} on port ${port}. Run: npx framer-code-link ${projectShortHash}`,
                })
                scheduleReconnect()
            }

            socket.onerror = event => {
                if (isStale()) return
                const failureCount = failureCountRef.current
                log.debug("WebSocket error event", {
                    type: event.type,
                    port,
                    attempt,
                    project: projectName,
                    failureCount,
                })
            }
        }

        connect()

        return () => {
            disposed = true
            log.debug("Cleaning up socket connection")
            clearRetry()
            const socket = socketRef.current
            socketRef.current = null
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.close()
            }
        }
    }, [state.project, state.permissionsGranted, api, syncTracker])

    const sendMessage = useCallback((payload: unknown) => {
        const socket = socketRef.current
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(payload))
        }
    }, [])

    const resolveConflicts = (choice: "local" | "remote") => {
        // Send all conflict resolutions at once
        sendMessage({
            type: "conflicts-resolved",
            resolution: choice,
        })
        dispatch({ type: "clear-conflicts" })
    }

    const confirmDeletes = () => {
        if (state.pendingDeletes.length === 0) {
            return
        }

        sendMessage({
            type: "delete-confirmed",
            fileNames: state.pendingDeletes.map(file => file.fileName),
        })
        dispatch({ type: "clear-pending-deletes" })
    }

    const keepDeletes = () => {
        if (state.pendingDeletes.length === 0) {
            return
        }

        sendMessage({
            type: "delete-cancelled",
            files: state.pendingDeletes,
        })
        dispatch({ type: "clear-pending-deletes" })
    }

    switch (state.mode) {
        case "delete_confirmation":
            if (state.pendingDeletes.length === 1) {
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
            return <DeletePanel files={state.pendingDeletes} onConfirm={confirmDeletes} onKeep={keepDeletes} />

        case "conflict_resolution":
            void framer.showUI({
                width: 320,
                height: 420,
                position: "center",
                resizable: "width",
            })
            return <ConflictPanel conflicts={state.conflicts} onResolve={resolveConflicts} />

        case "info":
            void framer.showUI({
                width: 260,
                height: 360,
                position: "center",
                resizable: false,
            })
            return <InfoPanel command={command} />

        default:
            void framer.setBackgroundMessage(backgroundStatusFromMode(state.mode))
            void framer.hideUI()
            return null
    }
}

function backgroundStatusFromMode(mode: Mode | undefined): string | null {
    switch (mode) {
        case "loading":
            return "Loading…"
        case "info":
            return null
        case "syncing":
            return "Syncing…"
        case "delete_confirmation":
            return null
        case "conflict_resolution":
            return null
        case "idle":
            return "Watching Files…"
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
            copyTimeout.current = setTimeout(() => { setCopyState("returning"); }, 2000)
        } catch {
            // Don't animate when failing
        }
    }

    return (
        <main>
            <div className="info">
                <div className="plugin-icon"></div>
                <h1>Code Link</h1>
                <p>
                    Run the command locally in your terminal to get started.{" "}
                    <a href="https://github.com/framer/plugins" target="_blank" rel="noopener noreferrer">
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
                <button onClick={() => { onResolve("local"); }}>Keep Local</button>
                <button className="framer-button-primary" onClick={() => { onResolve("remote"); }}>
                    Keep Framer
                </button>
            </div>
        </main>
    )
}

function createMessageHandler({
    dispatch,
    api,
    syncTracker,
}: {
    dispatch: (action: Action) => void
    api: CodeFilesAPI
    syncTracker: SyncTracker
}) {
    return async function handleMessage(message: IncomingMessage, socket: WebSocket) {
        log.debug("Handling message:", message.type)

        switch (message.type) {
            case "request-files":
                log.debug("Publishing snapshot to CLI")
                await api.publishSnapshot(socket)
                dispatch({
                    type: "set-mode",
                    mode: "syncing",
                })
                break
            case "file-change":
                log.debug("Applying remote change:", message.fileName)
                await api.applyRemoteChange(message.fileName, message.content, socket)
                syncTracker.remember(message.fileName, message.content)
                dispatch({ type: "set-mode", mode: "idle" })
                break
            case "file-delete":
                if (message.requireConfirmation) {
                    log.debug(`Delete requires confirmation for ${message.fileNames.length} file(s)`)
                    const files: PendingDelete[] = []
                    for (const fileName of message.fileNames) {
                        const content = await api.readCurrentContent(fileName)
                        files.push({ fileName, content })
                    }
                    dispatch({
                        type: "pending-deletes",
                        files,
                    })
                } else {
                    for (const fileName of message.fileNames) {
                        log.debug("Deleting file:", fileName)
                        await api.applyRemoteDelete(fileName)
                    }
                }
                break
            case "conflicts-detected":
                log.debug(`Received ${message.conflicts.length} conflicts from CLI`)
                dispatch({ type: "conflicts", conflicts: message.conflicts })
                break
            case "conflict-version-request": {
                log.debug(`Fetching conflict versions for ${message.conflicts.length} files`)
                const versions = await api.fetchConflictVersions(message.conflicts)
                log.debug(`Sending version response for ${versions.length} files`)
                socket.send(
                    JSON.stringify({
                        type: "conflict-version-response",
                        versions,
                    })
                )
                break
            }
            case "sync-complete":
                log.debug("Sync complete, transitioning to idle")
                dispatch({ type: "set-mode", mode: "idle" })
                break
            default:
                log.warn("Unknown message type:", (message as unknown as { type: string }).type)
                break
        }
    }
}
