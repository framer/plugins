import { execSync } from "node:child_process"
import https from "node:https"
import net from "node:net"
import { describe, expect, it, vi } from "vitest"
import { WebSocket, WebSocketServer } from "ws"
import { initConnection, sendMessage } from "./connection.ts"

function generateSelfSignedCert(): { key: string; cert: string } {
    const key = execSync("openssl genrsa 2048 2>/dev/null").toString()
    const cert = execSync(
        `openssl req -new -x509 -key /dev/stdin -days 365 -subj "/CN=localhost" -nodes 2>/dev/null`,
        { input: key }
    ).toString()
    return { key, cert }
}

const { key: TEST_KEY, cert: TEST_CERT } = generateSelfSignedCert()

describe("initConnection", () => {
    it("accepts secure websocket clients and routes handshake traffic", async () => {
        const port = await getFreePort()
        const connection = await initConnection(port, { key: TEST_KEY, cert: TEST_CERT })
        const client = new WebSocket(`wss://localhost:${port}`, {
            rejectUnauthorized: false,
        })
        let serverSocket: WebSocket | null = null

        const handshakeReceived = new Promise<{ projectId: string; projectName: string }>(resolve => {
            connection.on("handshake", (socket, message) => {
                serverSocket = socket
                resolve(message)
            })
        })

        const messageReceived = new Promise<{ type: string }>(resolve => {
            connection.on("message", message => resolve(message))
        })

        const outboundReceived = new Promise<{ type: string }>((resolve, reject) => {
            client.on("message", data => {
                try {
                    resolve(JSON.parse(data.toString()) as { type: string })
                } catch (error) {
                    reject(error)
                }
            })
        })

        await new Promise<void>((resolve, reject) => {
            client.once("open", () => resolve())
            client.once("error", reject)
        })

        client.send(JSON.stringify({ type: "handshake", projectId: "project-id", projectName: "Project Name" }))
        client.send(JSON.stringify({ type: "request-files" }))

        await expect(handshakeReceived).resolves.toMatchObject({
            projectId: "project-id",
            projectName: "Project Name",
        })
        await expect(messageReceived).resolves.toMatchObject({ type: "request-files" })
        expect(serverSocket).not.toBeNull()
        if (!serverSocket) throw new Error("Expected server socket after handshake")
        await expect(sendMessage(serverSocket, { type: "request-files" })).resolves.toBe(true)
        await expect(outboundReceived).resolves.toMatchObject({ type: "request-files" })

        client.close()
        connection.close()
    })
})

describe("initConnection error handling", () => {
    it("forwards WebSocketServer error events to the connection error handler without throwing", async () => {
        const port = await getFreePort()
        const onSpy = vi.spyOn(WebSocketServer.prototype, "on")
        const connection = await initConnection(port, { key: TEST_KEY, cert: TEST_CERT })
        const onError = vi.fn()
        connection.on("error", onError)

        const errorHandler = onSpy.mock.calls.find(([event]) => event === "error")?.[1] as
            | ((error: Error) => void)
            | undefined
        expect(errorHandler).toBeTypeOf("function")

        const boom = new Error("wss exploded")
        expect(() => {
            if (typeof errorHandler !== "function") throw new Error("Expected WebSocketServer error handler")
            errorHandler(boom)
        }).not.toThrow()

        expect(onError).toHaveBeenCalledOnce()
        expect(onError).toHaveBeenCalledWith(boom)

        connection.close()
        onSpy.mockRestore()
    })

    it("forwards HTTPS server runtime error events to the connection error handler without throwing", async () => {
        const port = await getFreePort()
        const onSpy = vi.spyOn(https.Server.prototype, "on")
        const connection = await initConnection(port, { key: TEST_KEY, cert: TEST_CERT })
        const onError = vi.fn()
        connection.on("error", onError)

        const errorHandler = (onSpy.mock.calls as Array<[string, unknown]>).find(([event]) => event === "error")?.[1] as
            | ((error: NodeJS.ErrnoException) => void)
            | undefined
        expect(errorHandler).toBeTypeOf("function")

        const boom = Object.assign(new Error("https exploded"), { code: "ECONNRESET" }) as NodeJS.ErrnoException
        expect(() => {
            if (typeof errorHandler !== "function") throw new Error("Expected HTTPS server error handler")
            errorHandler(boom)
        }).not.toThrow()

        expect(onError).toHaveBeenCalledOnce()
        expect(onError).toHaveBeenCalledWith(boom)

        connection.close()
        onSpy.mockRestore()
    })
})

async function getFreePort(): Promise<number> {
    return await new Promise((resolve, reject) => {
        const server = net.createServer()
        server.listen(0, () => {
            const address = server.address()
            if (!address || typeof address === "string") {
                reject(new Error("Failed to allocate a port"))
                return
            }

            server.close(error => {
                if (error) {
                    reject(error)
                    return
                }
                resolve(address.port)
            })
        })
        server.on("error", reject)
    })
}
