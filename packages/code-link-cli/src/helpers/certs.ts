/**
 * Certificate management for WSS support.
 *
 * Downloads FiloSottile's mkcert binary on first run, then shells out to it
 * to generate and trust a local CA + server certificate for wss://localhost.
 *
 * The mkcert binary is SHA-256 verified before execution (update
 * MKCERT_CHECKSUMS when bumping MKCERT_VERSION). The CA key is user-only;
 * never share or commit the cert directory.
 *
 * Certs and the mkcert binary are cached in ~/.framer/code-link/.
 */

import { createHash } from "crypto"
import { execFile } from "child_process"
import nodeFs from "fs"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { promisify } from "util"
import { debug, error, status, warn } from "../utils/logging.ts"

const execFileAsync = promisify(execFile)

export interface CertBundle {
    key: string
    cert: string
}

type RootCAState = "unchanged" | "copied" | "updated" | "missing"

/** Keep in sync with MKCERT_CHECKSUMS below. */
const MKCERT_VERSION = "v1.4.4"
export const CERT_DIR = process.env.FRAMER_CODE_LINK_CERT_DIR ?? path.join(os.homedir(), ".framer", "code-link")
const MKCERT_BIN_NAME = process.platform === "win32" ? "mkcert.exe" : "mkcert"
const MKCERT_BIN_PATH = path.join(CERT_DIR, MKCERT_BIN_NAME)
const ROOT_CA_CERT_PATH = path.join(CERT_DIR, "rootCA.pem")
const ROOT_CA_KEY_PATH = path.join(CERT_DIR, "rootCA-key.pem")
const SERVER_KEY_PATH = path.join(CERT_DIR, "localhost-key.pem")
const SERVER_CERT_PATH = path.join(CERT_DIR, "localhost.pem")

/**
 * SHA-256 checksums for mkcert v1.4.4 release binaries, keyed by "platform-arch".
 * These must be updated whenever MKCERT_VERSION changes.
 * Source: https://github.com/FiloSottile/mkcert/releases/tag/v1.4.4
 */
const MKCERT_CHECKSUMS: Record<string, string> = {
    "darwin-amd64": "a32dfab51f1845d51e810db8e47dcf0e6b51ae3422426514bf5a2b8302e97d4e",
    "darwin-arm64": "c8af0df44bce04359794dad8ea28d750437411d632748049d08644ffb66a60c6",
    "linux-amd64": "6d31c65b03972c6dc4a14ab429f2928300518b26503f58723e532d1b0a3bbb52",
    "linux-arm64": "b98f2cc69fd9147fe4d405d859c57504571adec0d3611c3eefd04107c7ac00d0",
    "windows-amd64": "d2660b50a9ed59eada480750561c96abc2ed4c9a38c6a24d93e30e0977631398",
    "windows-arm64": "793747256c562622d40127c8080df26add2fb44c50906ce9db63b42a5280582e",
}

/** Env vars passed to every mkcert invocation. */
const MKCERT_ENV = {
    ...process.env,
    CAROOT: CERT_DIR,
    JAVA_HOME: "",
    ...(process.platform === "darwin" ? { TRUST_STORES: "system" } : {}),
}


// Public API


/**
 * Returns a TLS cert bundle for the WSS server, or null if generation fails.
 * On first run, downloads mkcert, installs a local CA into trust stores, and
 * generates a server cert for localhost.
 */
export async function getOrCreateCerts(): Promise<CertBundle | null> {
    try {
        await fs.mkdir(CERT_DIR, { recursive: true })

        const mkcertPath = await ensureMkcertBinary()
        const rootCAState = await syncRootCA(mkcertPath)

        if (rootCAState !== "unchanged") {
            await invalidateServerCerts(rootCAState)
        }

        const existingKey = await loadFile(SERVER_KEY_PATH)
        const existingCert = await loadFile(SERVER_CERT_PATH)

        if (existingKey && existingCert) {
            debug("Loaded existing server certificates from disk")
            return { key: existingKey, cert: existingCert }
        }

        if (existingKey || existingCert) {
            await invalidateIncompleteServerBundle()
        }

        status("Generating local certificates to connect securely. You may be asked for your password.")
        await generateCerts(mkcertPath)

        const key = await fs.readFile(SERVER_KEY_PATH, "utf-8")
        const cert = await fs.readFile(SERVER_CERT_PATH, "utf-8")
        return { key, cert }
    } catch (err) {
        error(`Failed to set up TLS certificates: ${err instanceof Error ? err.message : String(err)}`)
        return null
    }
}


// Binary management


function getDownloadInfo(): { url: string; expectedChecksum: string } {
    const platformMap: Record<string, string> = {
        darwin: "darwin",
        linux: "linux",
        win32: "windows",
    }
    const archMap: Record<string, string> = {
        x64: "amd64",
        arm64: "arm64",
    }

    const platform = platformMap[process.platform]
    const arch = archMap[process.arch]

    if (!platform || !arch) {
        throw new Error(
            `Unsupported platform: ${process.platform}/${process.arch}. ` +
                `Install mkcert manually: https://github.com/FiloSottile/mkcert#installation`
        )
    }

    const key = `${platform}-${arch}`
    const expectedChecksum = MKCERT_CHECKSUMS[key]
    if (!expectedChecksum) {
        throw new Error(
            `No checksum available for mkcert ${key}. ` +
                `Install mkcert manually: https://github.com/FiloSottile/mkcert#installation`
        )
    }

    const ext = process.platform === "win32" ? ".exe" : ""
    const filename = `mkcert-${MKCERT_VERSION}-${platform}-${arch}${ext}`
    const url = `https://github.com/FiloSottile/mkcert/releases/download/${MKCERT_VERSION}/${filename}`
    return { url, expectedChecksum }
}

async function ensureMkcertBinary(): Promise<string> {
    const { url, expectedChecksum } = getDownloadInfo()

    // Fast path: verify any existing cached binary before reusing it.
    try {
        await fs.access(MKCERT_BIN_PATH, nodeFs.constants.X_OK)
        if (await verifyFileChecksum(MKCERT_BIN_PATH, expectedChecksum)) {
            debug("mkcert binary already available and verified")
            return MKCERT_BIN_PATH
        }
        warn("Cached mkcert binary failed checksum verification, re-downloading...")
    } catch {
        // Binary doesn't exist or isn't executable — fall through to download.
    }

    debug(`Downloading mkcert from ${url}`)
    status("Downloading mkcert for certificate generation...")

    try {
        const response = await fetch(url, { redirect: "follow" })
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const buffer = Buffer.from(await response.arrayBuffer())

        // Verify integrity before writing to disk.
        const actualChecksum = createHash("sha256").update(buffer).digest("hex")
        if (actualChecksum !== expectedChecksum) {
            throw new Error(
                `mkcert binary checksum mismatch — the download may have been tampered with.\n` +
                    `  Expected: ${expectedChecksum}\n` +
                    `  Actual:   ${actualChecksum}`
            )
        }

        await fs.writeFile(MKCERT_BIN_PATH, buffer, { mode: 0o755 })
        debug(`mkcert binary saved to ${MKCERT_BIN_PATH}`)
        return MKCERT_BIN_PATH
    } catch (err) {
        await fs.rm(MKCERT_BIN_PATH, { force: true })
        const message = err instanceof Error ? err.message : String(err)
        throw new Error(
            `Failed to download mkcert: ${message}\n` +
                `You can install it manually: https://github.com/FiloSottile/mkcert#installation\n` +
                `Then run: mkcert -install && mkcert -key-file "${SERVER_KEY_PATH}" -cert-file "${SERVER_CERT_PATH}" localhost 127.0.0.1`
        )
    }
}


// Certificate generation


async function generateCerts(mkcertPath: string): Promise<void> {
    debug("Running mkcert to install the local root CA...")
    try {
        await execFileAsync(mkcertPath, ["-install"], { env: MKCERT_ENV })
    } catch (err) {
        throw new Error(
            "Failed to install mkcert root CA into the system trust store. " +
                "If you canceled the password prompt, rerun this command and allow the install.\n" +
                `mkcert error: ${formatMkcertError(err)}`
        )
    }

    debug("Running mkcert to generate the localhost server certificate...")
    try {
        await execFileAsync(
            mkcertPath,
            ["-key-file", SERVER_KEY_PATH, "-cert-file", SERVER_CERT_PATH, "localhost", "127.0.0.1"],
            { env: MKCERT_ENV }
        )
    } catch (err) {
        if ((await loadFile(SERVER_KEY_PATH)) || (await loadFile(SERVER_CERT_PATH))) {
            await invalidateIncompleteServerBundle()
        }

        throw new Error(
            "Failed to generate localhost TLS certificate and key with mkcert.\n" +
                `mkcert error: ${formatMkcertError(err)}\n` +
                `Please rerun:\n  mkcert -key-file "${SERVER_KEY_PATH}" -cert-file "${SERVER_CERT_PATH}" localhost 127.0.0.1`
        )
    }

    const [generatedKey, generatedCert] = await Promise.all([loadFile(SERVER_KEY_PATH), loadFile(SERVER_CERT_PATH)])

    if (generatedKey && generatedCert) {
        debug("CA installed and server certificate generated successfully")
        return
    }

    if (generatedKey || generatedCert) {
        await invalidateIncompleteServerBundle()
    }

    throw new Error(
        "Failed to generate localhost TLS certificate and key with mkcert. " +
            "Please ensure mkcert is installed and rerun:\n" +
            `  mkcert -install && mkcert -key-file "${SERVER_KEY_PATH}" -cert-file "${SERVER_CERT_PATH}" localhost 127.0.0.1`
    )
}

async function syncRootCA(mkcertPath: string): Promise<RootCAState> {
    const existingRootCert = await loadFile(ROOT_CA_CERT_PATH)
    const existingRootKey = await loadFile(ROOT_CA_KEY_PATH)

    const { stdout } = await execFileAsync(mkcertPath, ["-CAROOT"], {
        env: { ...process.env, JAVA_HOME: "" },
    })
    const defaultCAROOT = stdout.trim()

    if (!defaultCAROOT || defaultCAROOT === CERT_DIR) {
        return existingRootCert && existingRootKey ? "unchanged" : "missing"
    }

    const defaultRootCert = await loadFile(path.join(defaultCAROOT, "rootCA.pem"))
    const defaultRootKey = await loadFile(path.join(defaultCAROOT, "rootCA-key.pem"))

    if (!defaultRootCert || !defaultRootKey) {
        return existingRootCert && existingRootKey ? "unchanged" : "missing"
    }

    if (existingRootCert === defaultRootCert && existingRootKey === defaultRootKey) {
        return "unchanged"
    }

    await fs.writeFile(ROOT_CA_CERT_PATH, defaultRootCert, { mode: 0o644 })
    await fs.writeFile(ROOT_CA_KEY_PATH, defaultRootKey, { mode: 0o600 })

    return existingRootCert && existingRootKey ? "updated" : "copied"
}


// Helpers


async function invalidateServerCerts(rootCAState: Exclude<RootCAState, "unchanged">): Promise<void> {
    const reasons: Record<Exclude<RootCAState, "unchanged">, string> = {
        copied: "Copied an existing mkcert root CA into the Code Link cache",
        updated: "Detected a different mkcert root CA and refreshed the Code Link cache",
        missing: "No cached mkcert root CA was available for the existing server certificate",
    }

    const hadServerBundle = (await loadFile(SERVER_KEY_PATH)) !== null || (await loadFile(SERVER_CERT_PATH)) !== null
    if (!hadServerBundle) return

    await fs.rm(SERVER_KEY_PATH, { force: true })
    await fs.rm(SERVER_CERT_PATH, { force: true })
    debug(`${reasons[rootCAState]}; removed stale localhost certificate`)
}

async function invalidateIncompleteServerBundle(): Promise<void> {
    await fs.rm(SERVER_KEY_PATH, { force: true })
    await fs.rm(SERVER_CERT_PATH, { force: true })
    warn("Found an incomplete localhost certificate bundle; regenerating it")
}

async function verifyFileChecksum(filePath: string, expectedHash: string): Promise<boolean> {
    const data = await fs.readFile(filePath)
    const actualHash = createHash("sha256").update(data).digest("hex")
    return actualHash === expectedHash
}

async function loadFile(filePath: string): Promise<string | null> {
    try {
        return await fs.readFile(filePath, "utf-8")
    } catch {
        return null
    }
}

function formatMkcertError(err: unknown): string {
    if (err instanceof Error) {
        const stdout = "stdout" in err && typeof err.stdout === "string" ? err.stdout.trim() : ""
        const stderr = "stderr" in err && typeof err.stderr === "string" ? err.stderr.trim() : ""
        const output = [stderr, stdout].filter(Boolean).join("\n")
        return output ? `${err.message}\n${output}` : err.message
    }

    return String(err)
}
