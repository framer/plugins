/**
 * WebSocket connection helper
 *
 * Wrapper around ws.Server that normalizes handshake and surfaces callbacks.
 */

import type { CliToPluginMessage, PluginToCliMessage } from "@code-link/shared"
import { WebSocket, WebSocketServer } from "ws"
import { debug, error } from "../utils/logging.ts"

export interface ConnectionCallbacks {
    onHandshake: (client: WebSocket, message: { projectId: string; projectName: string }) => void
    onMessage: (message: PluginToCliMessage) => void
    onDisconnect: (client: WebSocket) => void
    onError: (error: Error) => void
}

export interface Connection {
    on(event: "handshake", handler: ConnectionCallbacks["onHandshake"]): void
    on(event: "message", handler: ConnectionCallbacks["onMessage"]): void
    on(event: "disconnect", handler: ConnectionCallbacks["onDisconnect"]): void
    on(event: "error", handler: ConnectionCallbacks["onError"]): void
    close(): void
}

/**
 * Initializes a WebSocket server and returns a connection interface
 * Returns a Promise that resolves when the server is ready, or rejects on startup errors
 */
export function initConnection(port: number): Promise<Connection> {
    return new Promise((resolve, reject) => {
        const wss = new WebSocketServer({ port })
        const handlers: Partial<ConnectionCallbacks> = {}
        let connectionId = 0
        let isReady = false

        // Handle server-level errors (e.g., EADDRINUSE)
        wss.on("error", (err: NodeJS.ErrnoException) => {
            if (!isReady) {
                // Startup error - reject the promise with a helpful message
                if (err.code === "EADDRINUSE") {
                    error(`Port ${port} is already in use.`)
                    error(`This usually means another instance of Code Link is already running.`)
                    error(``)
                    error(`To fix this:`)
                    error(`  1. Close any other terminal running Code Link for this project`)
                    error(`  2. Or run: lsof -i :${port} | grep LISTEN`)
                    error(`     Then kill the process: kill -9 <PID>`)
                    reject(new Error(`Port ${port} is already in use`))
                } else {
                    error(`Failed to start WebSocket server: ${err.message}`)
                    reject(err)
                }
                return
            }
            // Runtime error - log but don't crash
            error(`WebSocket server error: ${err.message}`)
        })

        // Server is ready when it starts listening
        wss.on("listening", () => {
            isReady = true
            debug(`WebSocket server listening on port ${port}`)
            let activeClient: WebSocket | null = null

            wss.on("connection", (ws: WebSocket) => {
                const connId = ++connectionId
                let handshakeReceived = false
                debug(`Client connected (conn ${connId})`)

                ws.on("message", (data: Buffer) => {
                    try {
                        const message = JSON.parse(data.toString()) as PluginToCliMessage

                        if (message.type === "handshake") {
                            debug(`Received handshake (conn ${connId})`)
                            handshakeReceived = true
                            const previousActiveClient = activeClient
                            activeClient = ws

                            // Promote the new client.
                            // Close events from the previous client will be treated as stale.
                            if (previousActiveClient && previousActiveClient !== activeClient) {
                                debug(`Replacing active client with conn ${connId}`)
                                if (
                                    previousActiveClient.readyState === READY_STATE.OPEN ||
                                    previousActiveClient.readyState === READY_STATE.CONNECTING
                                ) {
                                    previousActiveClient.close()
                                }
                            }
                            handlers.onHandshake?.(ws, message)
                        } else if (handshakeReceived && activeClient === ws) {
                            handlers.onMessage?.(message)
                        } else if (handshakeReceived) {
                            debug(`Ignoring ${message.type} from stale client (conn ${connId})`)
                        } else {
                            // Ignore messages before handshake - plugin will send full snapshot after
                            debug(`Ignoring ${message.type} before handshake (conn ${connId})`)
                        }
                    } catch (err) {
                        error(`Failed to parse message:`, err)
                    }
                })

                ws.on("close", (code, reason) => {
                    debug(`Client disconnected (code: ${code}, reason: ${reason.toString()})`)
                    if (activeClient === ws) {
                        activeClient = null
                        handlers.onDisconnect?.(ws)
                    } else {
                        debug(`Ignoring disconnect from stale client (conn ${connId})`)
                    }
                })

                ws.on("error", err => {
                    error(`WebSocket error:`, err)
                })
            })

            resolve({
                on(event, handler) {
                    switch (event) {
                        case "handshake":
                            handlers.onHandshake = handler as ConnectionCallbacks["onHandshake"]
                            break
                        case "message":
                            handlers.onMessage = handler as ConnectionCallbacks["onMessage"]
                            break
                        case "disconnect":
                            handlers.onDisconnect = handler as ConnectionCallbacks["onDisconnect"]
                            break
                        case "error":
                            handlers.onError = handler as ConnectionCallbacks["onError"]
                            break
                    }
                },

                close(): void {
                    wss.close()
                },
            } satisfies Connection)
        })
    })
}

/**
 * WebSocket readyState constants for reference
 */
const READY_STATE = {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
} as const

function readyStateToString(state: number): string {
    switch (state) {
        case 0:
            return "CONNECTING"
        case 1:
            return "OPEN"
        case 2:
            return "CLOSING"
        case 3:
            return "CLOSED"
        default:
            return `UNKNOWN(${state})`
    }
}

/**
 * Sends a message to a connected socket
 * Returns false if the socket is not open (instead of throwing)
 */
export function sendMessage(socket: WebSocket, message: CliToPluginMessage): Promise<boolean> {
    return new Promise(resolve => {
        // Check socket state before attempting to send
        if (socket.readyState !== READY_STATE.OPEN) {
            const stateStr = readyStateToString(socket.readyState)
            debug(`Cannot send ${message.type}: socket is ${stateStr}`)
            resolve(false)
            return
        }

        socket.send(JSON.stringify(message), err => {
            if (err) {
                debug(`Send error for ${message.type}: ${err.message}`)
                resolve(false)
            } else {
                resolve(true)
            }
        })
    })
}
