/**
 * WebSocket connection helper
 *
 * Wrapper around ws.Server that normalizes handshake and surfaces callbacks.
 */

import type { CliToPluginMessage, PluginToCliMessage } from "@code-link/shared"
import https from "node:https"
import { WebSocket, WebSocketServer } from "ws"
import type { CertBundle } from "./certs.ts"
import { debug, error, info } from "../utils/logging.ts"

/** Custom close code sent when a new plugin tab replaces the active one. */
export const CLOSE_CODE_REPLACED = 4001

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
 * Initializes a WSS (TLS) WebSocket server and returns a connection interface.
 * Returns a Promise that resolves when the server is ready, or rejects on startup errors.
 */
export function initConnection(port: number, certs: CertBundle): Promise<Connection> {
    return new Promise((resolve, reject) => {
        const handlers: Partial<ConnectionCallbacks> = {}
        let connectionId = 0
        let isReady = false

        // Create WSS server
        const httpsServer = https.createServer({ key: certs.key, cert: certs.cert })
        const wss = new WebSocketServer({ server: httpsServer })
        wss.on("error", err => {
            error(`WebSocket server error: ${err.message}`)
            handlers.onError?.(err)
        })

        const handleError = (err: NodeJS.ErrnoException) => {
            if (!isReady) {
                if (err.code === "EADDRINUSE") {
                    error(`Port ${port} is already in use.`)
                    info(`This usually means another instance of Code Link is already running.`)
                    info(``)
                    info(`To fix this:`)
                    info(`  Close any other terminal running Code Link for this project`)
                    reject(new Error(`Port ${port} is already in use`))
                } else {
                    error(`Failed to start WebSocket server: ${err.message}`)
                    reject(err)
                }
                return
            }
            error(`WebSocket server error: ${err.message}`)
            handlers.onError?.(err)
        }

        const handleListening = () => {
            isReady = true
            debug(`WSS server listening on port ${port}`)
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

                            // Make this the active client, ignore stale close events from the old one.
                            if (previousActiveClient && previousActiveClient !== activeClient) {
                                debug(`Replacing active client with conn ${connId}`)
                                if (
                                    previousActiveClient.readyState === READY_STATE.OPEN ||
                                    previousActiveClient.readyState === READY_STATE.CONNECTING
                                ) {
                                    previousActiveClient.close(CLOSE_CODE_REPLACED)
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
                    httpsServer.close()
                },
            } satisfies Connection)
        }

        httpsServer.on("error", handleError)
        httpsServer.on("listening", handleListening)
        httpsServer.listen(port)
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
