/**
 * Certificate management for WSS support.
 *
 * Generates and persists a local CA + server certificate so the CLI can
 * serve WebSocket connections over TLS (wss://localhost).
 *
 * Certs are stored in ~/.framer/code-link/ and reused across runs.
 */

import { execSync } from "child_process"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { debug, info, status, warn } from "../utils/logging.ts"

export interface CertBundle {
    key: string
    cert: string
}

const CERT_DIR = path.join(os.homedir(), ".framer", "code-link")
const CA_KEY_PATH = path.join(CERT_DIR, "ca.key")
const CA_CERT_PATH = path.join(CERT_DIR, "ca.crt")
const SERVER_KEY_PATH = path.join(CERT_DIR, "localhost.key")
const SERVER_CERT_PATH = path.join(CERT_DIR, "localhost.crt")
const CA_INSTALLED_MARKER = path.join(CERT_DIR, ".ca-installed")

/**
 * Returns a TLS cert bundle for the WSS server, or null if generation fails.
 * On first run, generates a CA + server cert and attempts to install the CA
 * into the macOS system keychain (prompts for sudo).
 */
export async function getOrCreateCerts(): Promise<CertBundle | null> {
    try {
        await fs.mkdir(CERT_DIR, { recursive: true })

        const ca = await getOrCreateCA()
        const serverCert = await getOrCreateServerCert(ca)
        await tryInstallCA()

        return serverCert
    } catch (err) {
        warn(`Failed to generate TLS certificates: ${err instanceof Error ? err.message : err}`)
        return null
    }
}

async function loadFile(filePath: string): Promise<string | null> {
    try {
        return await fs.readFile(filePath, "utf-8")
    } catch {
        return null
    }
}

async function getOrCreateCA(): Promise<CertBundle> {
    const existingKey = await loadFile(CA_KEY_PATH)
    const existingCert = await loadFile(CA_CERT_PATH)

    if (existingKey && existingCert) {
        debug("Loaded existing CA from disk")
        return { key: existingKey, cert: existingCert }
    }

    debug("Generating new local CA...")
    const { createCA } = await import("mkcert")

    const ca = await createCA({
        organization: "Framer Code Link Local CA",
        countryCode: "US",
        state: "California",
        locality: "San Francisco",
        validity: 3650,
    })

    await fs.writeFile(CA_KEY_PATH, ca.key, { mode: 0o600 })
    await fs.writeFile(CA_CERT_PATH, ca.cert, { mode: 0o644 })
    debug("CA generated and saved")

    return ca
}

async function getOrCreateServerCert(ca: CertBundle): Promise<CertBundle> {
    const existingKey = await loadFile(SERVER_KEY_PATH)
    const existingCert = await loadFile(SERVER_CERT_PATH)

    if (existingKey && existingCert) {
        debug("Loaded existing server cert from disk")
        return { key: existingKey, cert: existingCert }
    }

    debug("Generating localhost server certificate...")
    const { createCert } = await import("mkcert")

    const cert = await createCert({
        ca: { key: ca.key, cert: ca.cert },
        domains: ["localhost", "127.0.0.1"],
        validity: 825,
    })

    await fs.writeFile(SERVER_KEY_PATH, cert.key, { mode: 0o600 })
    await fs.writeFile(SERVER_CERT_PATH, cert.cert, { mode: 0o644 })
    debug("Server certificate generated and saved")

    return cert
}

async function tryInstallCA(): Promise<void> {
    if (process.platform !== "darwin") return

    // Skip if already installed
    const marker = await loadFile(CA_INSTALLED_MARKER)
    if (marker !== null) return

    // Check if already trusted
    try {
        execSync(`security verify-cert -c "${CA_CERT_PATH}" 2>/dev/null`, { stdio: "ignore" })
        // Already trusted — write marker and return
        await fs.writeFile(CA_INSTALLED_MARKER, new Date().toISOString())
        debug("CA is already trusted")
        return
    } catch {
        // Not trusted yet
    }

    status("Generating a local certificate to connect securely. You may be asked for your password.")

    try {
        execSync(
            `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${CA_CERT_PATH}"`,
            { stdio: "inherit" }
        )
        await fs.writeFile(CA_INSTALLED_MARKER, new Date().toISOString())
        info("Certificate authority installed successfully.")
    } catch {
        warn("Could not install CA automatically. To trust the certificate manually, run:")
        warn(
            `  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${CA_CERT_PATH}"`
        )
    }
}
