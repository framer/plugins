import net from "node:net"
import { describe, expect, it, vi } from "vitest"
import { WebSocket, WebSocketServer } from "ws"
import { initConnection, sendMessage } from "./connection.ts"

const TEST_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDrogGoQi38Qtul
IzKaeMHoV9jJeyp3+hmQn7O5cQTxdjzYecqhMtUBvr3gklvSJgprDrGJ8tJSluHv
g83lKVPTo0EVIHxvkxX886yQddyo4048tOBZCGkz2LXwZE3LKCRWQZeNUoSJn19L
UPbavBoAM0/iosl+NAsAKL8dwT87i1m4jlojjRNLCzrpqt7VhKURaK85RJN8/Gv3
CpZWhTIeSu8LyQNjA1PjxuntGTNLbnjoFLAzJ6pxX2MGuCppvuwzByY0XkChEaJ7
P5nvWBVkr0wEVfYpXRgt4G9z2wuVAQsivjuo9jK6wtsJoOSp+05Js3cXdm5nJUij
uo2vzUA9AgMBAAECggEADBjGlgFDxBoYlZs/e0+swMVVw0436W3lBxgzzVbghpbn
28Mw5GKsLclBjThmT10VltZrxeW553SIh9fP565d99T/P9rpmH7IF7LYzpfGasM0
nog4pkl4wSkkegFkPwRCDU2TvrUYScptRXwUGDmk6hK4TK3Hw1tfnzP4T8o+eUt+
Za8MG8AeAMzBqumFQiAop6V0hdPhPLVeFGB2KMSXPzNt7HRgmIJtnLCi+lt0XaPR
5j/fn6ZZKHsZBdsueNjqKrKBKgUyXdEPOruxHEfBnI7e9Uvmua0/IHUV51/41+D+
Vp07I1YKsmhMvL5Id7GRoA54IPpnXy8amsmhZnkW0QKBgQD+Ezs9KYW7xJmT77IT
2MIryNzepNZmQooyzNQ7+80eBGtL6INlnFqeexiP9jcSIqwomR/H95NAO68sSrxs
yJnLMfHp5GN8X+htOZExlTHjFEEP8BIR4Pi1BhQR8oevFt3W/NqStx+obrkboxCk
Yj+7uX3+Ss7i3ADt2op8GHlbCQKBgQDtawHKUmNthWWh+tUh6ExTLYa99GKur7DS
gLjN1uBngo7cGVHJYiTp+iS7gqnE20ln7buVhc5os3F6fqPylb2Ig6NNsl9nAcjq
GMonX+dug612il2IK+/pIcVp6R6xABv1cV0neZD+JU8q31pADcAdErGO6Dvt4Z5X
N817Tu4klQKBgQD2gfAqwjuHVxLublPnX5ncY1CwD1wY8Rwmd4a+/+od4om7p0a8
8jsVojbNjkQWK1+/L/meyPysCHxHy+cO4H4eoEGm/Tjs9hyKxJyzb55sRD1v2iud
/xkugUw9sYKlhNkNelwSlut3Pp4IS2idJNnTKAAvFaOuhWe9XhiYmCI+CQKBgQDR
odmL1uF6E/5gXwWQEfhKvXkrAr2btv/vbr8+6UttukcAKs8ffSxQ+JE0jDPw4RtY
y/4FEYfmxQMfAPEsQnF/N5SbBzPb1SSdJ1RgHftQhq5Ea/oYQYttk2cnlDKIYStO
tlFliJ6w+SqFFYAv7LREN3xWTdKUwdG4+0nRZik6XQKBgQDNFBL/NNy8f4jP2LNe
Rr9yXnm7p7+ptHbIEaA6TmAqmBIgDWaxIyOgetPAs0VABtqeNk7CKSJyCDO3OGqe
g2XehSba4rjQEs5W2z1/8zvVPn20856uVhFOMMV5a3Sr7tQ9iFQ19JiW8ACKll2L
ThCKIGWM1NQFPq3sN0ooz4dKJA==
-----END PRIVATE KEY-----
`

const TEST_CERT = `-----BEGIN CERTIFICATE-----
MIIDCTCCAfGgAwIBAgIUZYxUt7lbGkNAA92GzPD0s5wFbvQwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI2MDMwNjE0MTY1N1oXDTI2MDMw
NzE0MTY1N1owFDESMBAGA1UEAwwJbG9jYWxob3N0MIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEA66IBqEIt/ELbpSMymnjB6FfYyXsqd/oZkJ+zuXEE8XY8
2HnKoTLVAb694JJb0iYKaw6xifLSUpbh74PN5SlT06NBFSB8b5MV/POskHXcqONO
PLTgWQhpM9i18GRNyygkVkGXjVKEiZ9fS1D22rwaADNP4qLJfjQLACi/HcE/O4tZ
uI5aI40TSws66are1YSlEWivOUSTfPxr9wqWVoUyHkrvC8kDYwNT48bp7RkzS254
6BSwMyeqcV9jBrgqab7sMwcmNF5AoRGiez+Z71gVZK9MBFX2KV0YLeBvc9sLlQEL
Ir47qPYyusLbCaDkqftOSbN3F3ZuZyVIo7qNr81APQIDAQABo1MwUTAdBgNVHQ4E
FgQUOsJWop04UtmQdQVbThKWqiLU3eIwHwYDVR0jBBgwFoAUOsJWop04UtmQdQVb
ThKWqiLU3eIwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAiphn
7KISByG40QtIPSLltzQmkv2RPfpSq+LcNkdXmYEBbRh53a3L4JodHkl9Tmd98NI8
wDPtqmA5A+L4Gc47v2O+b33IZ69g81JqYbjl2zNwYzCNEppirIfcyvalhFlly47A
Z8HbtXQgF19BnBQ+DOTc0Xcbaxg7o5JoCSAs+t7e9kS9pdQ6Ak4vWZ6w75IgeVYp
iaejAga8nqAw5JE4ORjnvJY5tNivOYRvslpYysLD4AW8twI52ZUqaRISZ4l+bYFI
WvpV0rjmehRqHvyb06B91jDCy8oOb4WKnpBVHiSho5jLAEmuZn0GKrO7FpqQmUEW
q3dVP+H9IROOHQsRwA==
-----END CERTIFICATE-----
`

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
