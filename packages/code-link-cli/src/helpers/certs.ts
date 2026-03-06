/**
 * Certificate management for WSS support.
 *
 * Downloads FiloSottile's mkcert binary on first run, then shells out to it
 * to generate and trust a local CA + server certificate for wss://localhost.
 *
 * Certs and the mkcert binary are cached in ~/.framer/code-link/.
 */

import { execFile } from "child_process"
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

const MKCERT_VERSION = "v1.4.4"
const CERT_DIR = path.join(os.homedir(), ".framer", "code-link")
const MKCERT_BIN_NAME = process.platform === "win32" ? "mkcert.exe" : "mkcert"
const MKCERT_BIN_PATH = path.join(CERT_DIR, MKCERT_BIN_NAME)
const SERVER_KEY_PATH = path.join(CERT_DIR, "localhost-key.pem")
const SERVER_CERT_PATH = path.join(CERT_DIR, "localhost.pem")

/** Env vars passed to every mkcert invocation. */
const MKCERT_ENV = {
    ...process.env,
    CAROOT: CERT_DIR,
    JAVA_HOME: "",
    ...(process.platform === "darwin" ? { TRUST_STORES: "system" } : {}),
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a TLS cert bundle for the WSS server, or null if generation fails.
 * On first run, downloads mkcert, installs a local CA into trust stores, and
 * generates a server cert for localhost.
 */
export async function getOrCreateCerts(): Promise<CertBundle | null> {
    try {
        await fs.mkdir(CERT_DIR, { recursive: true })

        // Fast path: certs already exist on disk
        const existingKey = await loadFile(SERVER_KEY_PATH)
        const existingCert = await loadFile(SERVER_CERT_PATH)

        if (existingKey && existingCert) {
            debug("Loaded existing server certificates from disk")
            return { key: existingKey, cert: existingCert }
        }

        // Slow path: download mkcert (if needed) and generate certs
        const mkcertPath = await ensureMkcertBinary()
        status("Generating local certificates to connect securely. You may be asked for your password.")
        await generateCerts(mkcertPath)

        const key = await fs.readFile(SERVER_KEY_PATH, "utf-8")
        const cert = await fs.readFile(SERVER_CERT_PATH, "utf-8")
        return { key, cert }
    } catch (err) {
        error(`Failed to set up TLS certificates: ${err instanceof Error ? err.message : err}`)
        return null
    }
}

// ---------------------------------------------------------------------------
// Binary management
// ---------------------------------------------------------------------------

function getDownloadUrl(): string {
    const platformMap: Record<string, string> = {
        darwin: "darwin",
        linux: "linux",
        win32: "windows",
    }
    const archMap: Record<string, string> = {
        x64: "amd64",
        arm64: "arm64",
        arm: "arm",
    }

    const platform = platformMap[process.platform]
    const arch = archMap[process.arch]

    if (!platform || !arch) {
        throw new Error(
            `Unsupported platform: ${process.platform}/${process.arch}. ` +
                `Install mkcert manually: https://github.com/FiloSottile/mkcert#installation`
        )
    }

    const ext = process.platform === "win32" ? ".exe" : ""
    const filename = `mkcert-${MKCERT_VERSION}-${platform}-${arch}${ext}`
    return `https://github.com/FiloSottile/mkcert/releases/download/${MKCERT_VERSION}/${filename}`
}

async function ensureMkcertBinary(): Promise<string> {
    try {
        await fs.access(MKCERT_BIN_PATH, fs.constants.X_OK)
        debug("mkcert binary already available")
        return MKCERT_BIN_PATH
    } catch {
        // Need to download
    }

    const url = getDownloadUrl()
    debug(`Downloading mkcert from ${url}`)
    status("Downloading mkcert for certificate generation...")

    try {
        const response = await fetch(url, { redirect: "follow" })
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const buffer = Buffer.from(await response.arrayBuffer())
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

// ---------------------------------------------------------------------------
// Certificate generation
// ---------------------------------------------------------------------------

async function generateCerts(mkcertPath: string): Promise<void> {
    // Install the CA into platform trust stores (idempotent, safe to run every time).
    // All stdio is piped to suppress mkcert's chatty output. On macOS the password
    // prompt is a system GUI dialog, not a terminal prompt, so this is fine.
    debug("Running mkcert -install...")
    try {
        if (process.platform === "darwin") {
            // Warm up sudo once so mkcert's internal security commands can reuse it.
            await execFileAsync("sudo", ["--prompt=Sudo password:", "-v"], { env: MKCERT_ENV })
        }
        await execFileAsync(mkcertPath, ["-install"], { env: MKCERT_ENV })
        debug("CA installed into trust stores")
    } catch (err) {
        // Non-fatal — certs still work, browser just won't auto-trust them
        warn(`Could not install CA into system trust store: ${err instanceof Error ? err.message : err}`)
        warn("Your browser may show a certificate warning.")
    }

    // Generate server certificate for localhost
    debug("Generating server certificate...")
    await execFileAsync(
        mkcertPath,
        ["-key-file", SERVER_KEY_PATH, "-cert-file", SERVER_CERT_PATH, "localhost", "127.0.0.1"],
        { env: MKCERT_ENV }
    )
    debug("Server certificate generated successfully")
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadFile(filePath: string): Promise<string | null> {
    try {
        return await fs.readFile(filePath, "utf-8")
    } catch {
        return null
    }
}
