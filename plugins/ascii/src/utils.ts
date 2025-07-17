export const BASE_PATH = ""

/**
 * Convenience method to load an image from a canvas.
 * As a transferable bytes array
 */
export function bytesFromCanvas(canvas: HTMLCanvasElement): Promise<Uint8Array | null> {
    return new Promise<Uint8Array>((resolve, reject) => {
        canvas.toBlob(blob => {
            if (!blob) throw new Error("Blob does not exist")

            const reader = new FileReader()

            reader.onload = () => {
                if (!reader.result) {
                    throw new Error("Reader result does not exist")
                }

                resolve(new Uint8Array(reader.result as ArrayBuffer))
            }
            reader.onerror = () => {
                reject(new Error("Could not read from blob"))
            }
            reader.readAsArrayBuffer(blob)
        })
    })
}

export function assert(condition: unknown, ...msg: unknown[]): asserts condition {
    if (condition) return

    const e = Error("Assertion Error" + (msg.length > 0 ? ": " + msg.join(" ") : ""))
    // Hack the stack so the assert call itself disappears. Works in jest and in chrome.
    if (e.stack) {
        try {
            const lines = e.stack.split("\n")
            if (lines[1]?.includes("assert")) {
                lines.splice(1, 1)
                e.stack = lines.join("\n")
            } else if (lines[0]?.includes("assert")) {
                lines.splice(0, 1)
                e.stack = lines.join("\n")
            }
        } catch {
            // nothing
        }
    }
    throw e
}

export function getPermissionTitle(isAllowed: boolean): string | undefined {
    return isAllowed ? undefined : "Insufficient permissions"
}
