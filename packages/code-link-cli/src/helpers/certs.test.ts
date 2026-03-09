import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type ExecFileMock = ReturnType<typeof vi.fn>

/**
 * Mirror of MKCERT_CHECKSUMS from certs.ts so we can make `createHash` return
 * the expected value for the current platform, letting the cached-binary
 * verification pass on the dummy file written in beforeEach.
 */
const MKCERT_CHECKSUMS: Record<string, string> = {
    "darwin-amd64": "a32dfab51f1845d51e810db8e47dcf0e6b51ae3422426514bf5a2b8302e97d4e",
    "darwin-arm64": "c8af0df44bce04359794dad8ea28d750437411d632748049d08644ffb66a60c6",
    "linux-amd64": "6d31c65b03972c6dc4a14ab429f2928300518b26503f58723e532d1b0a3bbb52",
    "linux-arm64": "b98f2cc69fd9147fe4d405d859c57504571adec0d3611c3eefd04107c7ac00d0",
    "windows-amd64": "d2660b50a9ed59eada480750561c96abc2ed4c9a38c6a24d93e30e0977631398",
    "windows-arm64": "793747256c562622d40127c8080df26add2fb44c50906ce9db63b42a5280582e",
}

const platformMap: Record<string, string> = { darwin: "darwin", linux: "linux", win32: "windows" }
const archMap: Record<string, string> = { x64: "amd64", arm64: "arm64" }
const currentPlatformKey = `${platformMap[process.platform]}-${archMap[process.arch]}`
const currentPlatformChecksum = MKCERT_CHECKSUMS[currentPlatformKey]


// Shared test helpers
function setupCommonMocks(opts: {
    tempHome: string
    certDir: string
    execFileMock: ExecFileMock
    fetchMock: ReturnType<typeof vi.fn>
}) {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.stubEnv("HOME", opts.tempHome)
    vi.stubEnv("USERPROFILE", opts.tempHome)
    vi.stubEnv("FRAMER_CODE_LINK_CERT_DIR", opts.certDir)
    vi.stubGlobal("fetch", opts.fetchMock)
    vi.doMock("child_process", () => ({ execFile: opts.execFileMock }))
    vi.doMock("util", () => ({
        promisify:
            (fn: (...args: unknown[]) => void) =>
            (...args: unknown[]) =>
                new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
                    fn(...args, (error: Error | null, stdout = "", stderr = "") => {
                        if (error) {
                            reject(error)
                            return
                        }
                        resolve({ stdout, stderr })
                    })
                }),
    }))
}

function mockCryptoSequence(checksums: string[]) {
    let callIndex = 0
    vi.doMock("crypto", async () => {
        const actual = await vi.importActual<typeof import("crypto")>("crypto")
        return {
            ...actual,
            createHash: () => ({
                update: () => ({
                    digest: () => checksums[callIndex++] ?? checksums.at(-1),
                }),
            }),
        }
    })
}

function mockCryptoConstant(hash: string) {
    mockCryptoSequence([hash])
}

function teardownMocks() {
    vi.doUnmock("child_process")
    vi.doUnmock("util")
    vi.doUnmock("crypto")
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
}

function fakeFetchResponse(opts?: { ok?: boolean; status?: number; statusText?: string }) {
    return {
        ok: opts?.ok ?? true,
        status: opts?.status ?? 200,
        statusText: opts?.statusText ?? "OK",
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }
}


// Integration tests — cached binary, root CA syncing, cert generation
describe("getOrCreateCerts", () => {
    let tempHome: string
    let certDir: string
    let execFileMock: ExecFileMock

    beforeEach(async () => {
        tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-certs-"))
        certDir = path.join(tempHome, ".framer", "code-link")
        execFileMock = vi.fn()

        await fs.mkdir(certDir, { recursive: true })
        await fs.writeFile(path.join(certDir, "mkcert"), "", { mode: 0o755 })

        setupCommonMocks({ tempHome, certDir, execFileMock, fetchMock: vi.fn() })
        mockCryptoConstant(currentPlatformChecksum)
    })

    afterEach(async () => {
        teardownMocks()
        await fs.rm(tempHome, { recursive: true, force: true })
    })

    it("reuses the cached localhost certificate when the cached root CA is intact", async () => {
        await fs.writeFile(path.join(certDir, "rootCA.pem"), "root-cert")
        await fs.writeFile(path.join(certDir, "rootCA-key.pem"), "root-key")
        await fs.writeFile(path.join(certDir, "localhost-key.pem"), "server-key")
        await fs.writeFile(path.join(certDir, "localhost.pem"), "server-cert")

        mockMkcert(execFileMock, { defaultCAROOT: certDir })

        const { getOrCreateCerts } = await import("./certs.ts")
        const certs = await getOrCreateCerts()

        expect(certs).toEqual({ key: "server-key", cert: "server-cert" })
        expect(execFileMock).toHaveBeenCalledTimes(1)
        expect(execFileMock).toHaveBeenCalledWith(
            path.join(certDir, "mkcert"),
            ["-CAROOT"],
            expect.any(Object),
            expect.any(Function)
        )
    })

    it("regenerates the localhost certificate when the cached root CA is missing", async () => {
        const defaultCAROOT = path.join(tempHome, "default-caroot")
        await fs.mkdir(defaultCAROOT, { recursive: true })
        await fs.writeFile(path.join(defaultCAROOT, "rootCA.pem"), "default-root-cert")
        await fs.writeFile(path.join(defaultCAROOT, "rootCA-key.pem"), "default-root-key")
        await fs.writeFile(path.join(certDir, "localhost-key.pem"), "stale-key")
        await fs.writeFile(path.join(certDir, "localhost.pem"), "stale-cert")

        mockMkcert(execFileMock, {
            defaultCAROOT,
            generatedKey: "new-server-key",
            generatedCert: "new-server-cert",
        })

        const { getOrCreateCerts } = await import("./certs.ts")
        const certs = await getOrCreateCerts()

        expect(certs).toEqual({ key: "new-server-key", cert: "new-server-cert" })
        await expect(fs.readFile(path.join(certDir, "rootCA.pem"), "utf-8")).resolves.toBe("generated-root-cert")
        await expect(fs.readFile(path.join(certDir, "rootCA-key.pem"), "utf-8")).resolves.toBe("generated-root-key")
    })

    it("regenerates the localhost certificate when the cached root CA differs from mkcert's default CA", async () => {
        const defaultCAROOT = path.join(tempHome, "default-caroot")
        await fs.mkdir(defaultCAROOT, { recursive: true })
        await fs.writeFile(path.join(defaultCAROOT, "rootCA.pem"), "fresh-root-cert")
        await fs.writeFile(path.join(defaultCAROOT, "rootCA-key.pem"), "fresh-root-key")
        await fs.writeFile(path.join(certDir, "rootCA.pem"), "stale-root-cert")
        await fs.writeFile(path.join(certDir, "rootCA-key.pem"), "stale-root-key")
        await fs.writeFile(path.join(certDir, "localhost-key.pem"), "stale-key")
        await fs.writeFile(path.join(certDir, "localhost.pem"), "stale-cert")

        mockMkcert(execFileMock, {
            defaultCAROOT,
            generatedKey: "rotated-server-key",
            generatedCert: "rotated-server-cert",
        })

        const { getOrCreateCerts } = await import("./certs.ts")
        const certs = await getOrCreateCerts()

        expect(certs).toEqual({ key: "rotated-server-key", cert: "rotated-server-cert" })
        await expect(fs.readFile(path.join(certDir, "rootCA.pem"), "utf-8")).resolves.toBe("generated-root-cert")
        await expect(fs.readFile(path.join(certDir, "rootCA-key.pem"), "utf-8")).resolves.toBe("generated-root-key")
    })

    it("returns null when mkcert -install fails", async () => {
        const defaultCAROOT = path.join(tempHome, "default-caroot")
        await fs.mkdir(defaultCAROOT, { recursive: true })
        await fs.writeFile(path.join(defaultCAROOT, "rootCA.pem"), "default-root-cert")
        await fs.writeFile(path.join(defaultCAROOT, "rootCA-key.pem"), "default-root-key")

        mockMkcert(execFileMock, {
            defaultCAROOT,
            installError: "trust store install failed",
        })

        const { getOrCreateCerts } = await import("./certs.ts")
        const certs = await getOrCreateCerts()

        expect(certs).toBeNull()
        // -CAROOT + -install (which threw)
        expect(execFileMock).toHaveBeenCalledTimes(2)
    })

    it("returns null when mkcert -key-file fails without writing any files", async () => {
        const defaultCAROOT = path.join(tempHome, "default-caroot")
        await fs.mkdir(defaultCAROOT, { recursive: true })
        await fs.writeFile(path.join(defaultCAROOT, "rootCA.pem"), "default-root-cert")
        await fs.writeFile(path.join(defaultCAROOT, "rootCA-key.pem"), "default-root-key")

        mockMkcert(execFileMock, {
            defaultCAROOT,
            generateError: "mkcert exited before writing certs",
            skipServerBundleWrite: true,
        })

        const { getOrCreateCerts } = await import("./certs.ts")
        const certs = await getOrCreateCerts()

        expect(certs).toBeNull()
        // -CAROOT + -install + -key-file (which threw)
        expect(execFileMock).toHaveBeenCalledTimes(3)
        await expect(fs.readFile(path.join(certDir, "localhost-key.pem"), "utf-8")).rejects.toThrow()
        await expect(fs.readFile(path.join(certDir, "localhost.pem"), "utf-8")).rejects.toThrow()
    })

    it("returns null and cleans up when only the server key is generated before failure", async () => {
        const defaultCAROOT = path.join(tempHome, "default-caroot")
        await fs.mkdir(defaultCAROOT, { recursive: true })
        await fs.writeFile(path.join(defaultCAROOT, "rootCA.pem"), "default-root-cert")
        await fs.writeFile(path.join(defaultCAROOT, "rootCA-key.pem"), "default-root-key")

        mockMkcert(execFileMock, {
            defaultCAROOT,
            generatedKey: "partial-key",
            generateError: "mkcert exited while writing certs",
            skipCertWrite: true,
        })

        const { getOrCreateCerts } = await import("./certs.ts")
        const certs = await getOrCreateCerts()

        expect(certs).toBeNull()
        expect(execFileMock).toHaveBeenCalledTimes(3)
        // Partial files should be cleaned up.
        await expect(fs.readFile(path.join(certDir, "localhost-key.pem"), "utf-8")).rejects.toThrow()
        await expect(fs.readFile(path.join(certDir, "localhost.pem"), "utf-8")).rejects.toThrow()
    })
})


// Download URL selection
describe("download URL selection", () => {
    let tempHome: string
    let certDir: string
    let execFileMock: ExecFileMock
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(async () => {
        tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-certs-"))
        certDir = path.join(tempHome, ".framer", "code-link")
        execFileMock = vi.fn()
        fetchMock = vi.fn()

        await fs.mkdir(certDir, { recursive: true })
        // No mkcert binary — forces download path.

        setupCommonMocks({ tempHome, certDir, execFileMock, fetchMock })
        mockCryptoConstant(currentPlatformChecksum)
    })

    afterEach(async () => {
        teardownMocks()
        await fs.rm(tempHome, { recursive: true, force: true })
    })

    it("fetches from the correct GitHub release URL for the current platform", async () => {
        const ext = process.platform === "win32" ? ".exe" : ""
        const expectedFilename = `mkcert-v1.4.4-${platformMap[process.platform]}-${archMap[process.arch]}${ext}`
        const expectedUrl = `https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/${expectedFilename}`

        fetchMock.mockResolvedValue(fakeFetchResponse())
        mockMkcert(execFileMock, {
            defaultCAROOT: certDir,
            generatedKey: "key",
            generatedCert: "cert",
        })

        const { getOrCreateCerts } = await import("./certs.ts")
        await getOrCreateCerts()

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock).toHaveBeenCalledWith(expectedUrl, { redirect: "follow" })
    })

    it("includes .exe extension on win32 and omits it elsewhere", () => {
        const ext = process.platform === "win32" ? ".exe" : ""
        const filename = `mkcert-v1.4.4-${platformMap[process.platform]}-${archMap[process.arch]}${ext}`
        if (process.platform === "win32") {
            expect(filename).toMatch(/\.exe$/)
        } else {
            expect(filename).not.toMatch(/\.exe$/)
        }
    })
})


// Binary cache fast-path and SHA-256 verification
describe("binary cache and SHA-256 verification", () => {
    let tempHome: string
    let certDir: string
    let execFileMock: ExecFileMock
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(async () => {
        tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-certs-"))
        certDir = path.join(tempHome, ".framer", "code-link")
        execFileMock = vi.fn()
        fetchMock = vi.fn()

        await fs.mkdir(certDir, { recursive: true })

        setupCommonMocks({ tempHome, certDir, execFileMock, fetchMock })
    })

    afterEach(async () => {
        teardownMocks()
        await fs.rm(tempHome, { recursive: true, force: true })
    })

    it("skips download when the cached binary passes checksum verification", async () => {
        await fs.writeFile(path.join(certDir, "mkcert"), "cached-binary", { mode: 0o755 })
        await fs.writeFile(path.join(certDir, "rootCA.pem"), "root-cert")
        await fs.writeFile(path.join(certDir, "rootCA-key.pem"), "root-key")
        await fs.writeFile(path.join(certDir, "localhost-key.pem"), "server-key")
        await fs.writeFile(path.join(certDir, "localhost.pem"), "server-cert")

        mockCryptoConstant(currentPlatformChecksum)
        mockMkcert(execFileMock, { defaultCAROOT: certDir })

        const { getOrCreateCerts } = await import("./certs.ts")
        const certs = await getOrCreateCerts()

        expect(certs).toEqual({ key: "server-key", cert: "server-cert" })
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("re-downloads when the cached binary fails checksum verification", async () => {
        await fs.writeFile(path.join(certDir, "mkcert"), "tampered-binary", { mode: 0o755 })
        await fs.writeFile(path.join(certDir, "rootCA.pem"), "root-cert")
        await fs.writeFile(path.join(certDir, "rootCA-key.pem"), "root-key")
        await fs.writeFile(path.join(certDir, "localhost-key.pem"), "server-key")
        await fs.writeFile(path.join(certDir, "localhost.pem"), "server-cert")

        // First digest: cached binary verification → wrong. Second: download verification → correct.
        mockCryptoSequence(["bad-checksum-for-cached-binary", currentPlatformChecksum])
        fetchMock.mockResolvedValue(fakeFetchResponse())
        mockMkcert(execFileMock, { defaultCAROOT: certDir })

        const { getOrCreateCerts } = await import("./certs.ts")
        const certs = await getOrCreateCerts()

        expect(certs).toEqual({ key: "server-key", cert: "server-cert" })
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("downloads fresh when no binary exists on disk", async () => {
        mockCryptoConstant(currentPlatformChecksum)
        fetchMock.mockResolvedValue(fakeFetchResponse())
        mockMkcert(execFileMock, {
            defaultCAROOT: certDir,
            generatedKey: "key",
            generatedCert: "cert",
        })

        const { getOrCreateCerts } = await import("./certs.ts")
        const certs = await getOrCreateCerts()

        expect(certs).toEqual({ key: "key", cert: "cert" })
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("rejects a download whose SHA-256 checksum does not match", async () => {
        // Every digest call returns a bad checksum.
        mockCryptoConstant("bad-checksum-always")
        fetchMock.mockResolvedValue(fakeFetchResponse())

        const { getOrCreateCerts } = await import("./certs.ts")
        const certs = await getOrCreateCerts()

        expect(certs).toBeNull()
        // Binary should be cleaned up after failed verification.
        await expect(fs.access(path.join(certDir, "mkcert"))).rejects.toThrow()
    })

    it("writes the binary to disk when the download checksum matches", async () => {
        mockCryptoConstant(currentPlatformChecksum)
        fetchMock.mockResolvedValue(fakeFetchResponse())
        mockMkcert(execFileMock, {
            defaultCAROOT: certDir,
            generatedKey: "key",
            generatedCert: "cert",
        })

        const { getOrCreateCerts } = await import("./certs.ts")
        await getOrCreateCerts()

        await expect(fs.access(path.join(certDir, "mkcert"))).resolves.toBeUndefined()
    })
})


// Error handling
describe("error handling", () => {
    let tempHome: string
    let certDir: string
    let execFileMock: ExecFileMock
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(async () => {
        tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "code-link-certs-"))
        certDir = path.join(tempHome, ".framer", "code-link")
        execFileMock = vi.fn()
        fetchMock = vi.fn()

        await fs.mkdir(certDir, { recursive: true })

        setupCommonMocks({ tempHome, certDir, execFileMock, fetchMock })
        mockCryptoConstant(currentPlatformChecksum)
    })

    afterEach(async () => {
        teardownMocks()
        await fs.rm(tempHome, { recursive: true, force: true })
    })

    it("returns null when fetch returns a non-OK response", async () => {
        // No binary on disk — triggers download.
        fetchMock.mockResolvedValue(fakeFetchResponse({ ok: false, status: 404, statusText: "Not Found" }))

        const { getOrCreateCerts } = await import("./certs.ts")
        const certs = await getOrCreateCerts()

        expect(certs).toBeNull()
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("returns null and cleans up when fetch throws a network error", async () => {
        fetchMock.mockRejectedValue(new Error("network timeout"))

        const { getOrCreateCerts } = await import("./certs.ts")
        const certs = await getOrCreateCerts()

        expect(certs).toBeNull()
        await expect(fs.access(path.join(certDir, "mkcert"))).rejects.toThrow()
    })

    it("cleans up an incomplete server bundle when only the key exists before generation", async () => {
        await fs.writeFile(path.join(certDir, "mkcert"), "", { mode: 0o755 })
        await fs.writeFile(path.join(certDir, "rootCA.pem"), "root-cert")
        await fs.writeFile(path.join(certDir, "rootCA-key.pem"), "root-key")
        await fs.writeFile(path.join(certDir, "localhost-key.pem"), "orphaned-key")
        // No localhost.pem — incomplete bundle triggers regeneration.

        mockMkcert(execFileMock, {
            defaultCAROOT: certDir,
            generatedKey: "fresh-key",
            generatedCert: "fresh-cert",
        })

        const { getOrCreateCerts } = await import("./certs.ts")
        const certs = await getOrCreateCerts()

        expect(certs).toEqual({ key: "fresh-key", cert: "fresh-cert" })
    })

    it("cleans up an incomplete server bundle when only the cert exists before generation", async () => {
        await fs.writeFile(path.join(certDir, "mkcert"), "", { mode: 0o755 })
        await fs.writeFile(path.join(certDir, "rootCA.pem"), "root-cert")
        await fs.writeFile(path.join(certDir, "rootCA-key.pem"), "root-key")
        await fs.writeFile(path.join(certDir, "localhost.pem"), "orphaned-cert")
        // No localhost-key.pem — incomplete bundle triggers regeneration.

        mockMkcert(execFileMock, {
            defaultCAROOT: certDir,
            generatedKey: "fresh-key",
            generatedCert: "fresh-cert",
        })

        const { getOrCreateCerts } = await import("./certs.ts")
        const certs = await getOrCreateCerts()

        expect(certs).toEqual({ key: "fresh-key", cert: "fresh-cert" })
    })
})

/**
 * Mocks mkcert's execFile behavior. Handles three commands:
 *  - `-CAROOT` → returns defaultCAROOT
 *  - `-install` → writes rootCA files (may error via installError)
 *  - `-key-file ... -cert-file ...` → writes server cert/key (may error via generateError)
 */
function mockMkcert(
    execFileMock: ExecFileMock,
    options: {
        defaultCAROOT: string
        generatedKey?: string
        generatedCert?: string
        installError?: string
        generateError?: string
        skipServerBundleWrite?: boolean
        skipCertWrite?: boolean
    }
) {
    execFileMock.mockImplementation((...args: unknown[]) => {
        const callback = args.at(-1) as (error: Error | null, stdout?: string, stderr?: string) => void
        const commandArgs = args[1] as string[]
        const commandOptions = args[2] as { env?: NodeJS.ProcessEnv } | undefined

        void (async () => {
            if (commandArgs[0] === "-CAROOT") {
                callback(null, `${options.defaultCAROOT}\n`, "")
                return
            }

            if (commandArgs[0] === "-install") {
                if (commandOptions?.env?.CAROOT) {
                    await fs.mkdir(commandOptions.env.CAROOT, { recursive: true })
                    await fs.writeFile(path.join(commandOptions.env.CAROOT, "rootCA.pem"), "generated-root-cert")
                    await fs.writeFile(path.join(commandOptions.env.CAROOT, "rootCA-key.pem"), "generated-root-key")
                }

                callback(options.installError ? new Error(options.installError) : null, "", "")
                return
            }

            if (commandArgs[0] === "-key-file") {
                const keyPath = commandArgs[1]
                const certPath = commandArgs[3]

                if (!keyPath || !certPath || commandArgs[2] !== "-cert-file") {
                    callback(new Error("Missing key/cert output path"))
                    return
                }

                if (!options.skipServerBundleWrite) {
                    await fs.writeFile(keyPath, options.generatedKey ?? "generated-key")
                    if (!options.skipCertWrite) {
                        await fs.writeFile(certPath, options.generatedCert ?? "generated-cert")
                    }
                }

                callback(options.generateError ? new Error(options.generateError) : null, "", "")
                return
            }

            callback(new Error(`Unexpected mkcert invocation: ${commandArgs.join(" ")}`))
        })().catch((error: unknown) => {
            callback(error instanceof Error ? error : new Error(String(error)))
        })
    })
}
