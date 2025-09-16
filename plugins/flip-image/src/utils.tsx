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
