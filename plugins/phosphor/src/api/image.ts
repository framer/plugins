import { isString } from "./utils"

export type ImageId = string

export type ImageBase64 = string

export type URLString = string

export interface FramerImage {
    /** A unique id. */
    id: ImageId
    /** Something that can be rendered within the iFrame. */
    url: string
    /** The original file name. */
    name: string
    /** The original file width. */
    width: number
    /** The original file height. */
    height: number
}

export interface ImageInput {
    data: File | URLString | ImageBase64
    name?: string
}

export interface ImageData {
    /** The file data as RAW bytes. (UInt8Array) */
    bytes: ArrayBuffer
    /* The mime type of the image file */
    mimeType: string
    /** The file name. */
    name?: string
}

export interface SVGData {
    /** The SVG data as a string. */
    svg: string
    /** The file name. */
    name?: string
}

export function isValidUrl(url: unknown): url is URLString {
    if (!isString(url)) return false

    try {
        new URL(url as string)
        return true
    } catch {
        return false
    }
}

export async function createImageDataFromInput(input: ImageInput): Promise<ImageData> {
    let file: FileInfo

    if (input.data instanceof File) {
        file = await getBytesFromFile(input.data)
    } else if (isValidUrl(input.data)) {
        file = await getBytesFromUrl(input.data)
    } else {
        throw new Error("Invalid image data")
    }

    return {
        bytes: file.bytes.buffer,
        mimeType: file.mimeType,
        name: input.name,
    }
}

export interface FileInfo {
    bytes: Uint8Array
    mimeType: string
}

export async function getBytesFromFile(file: File): Promise<FileInfo> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = event => {
            const arrayBuffer = event.target?.result
            if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) {
                reject(new Error("Failed to read file, arrayBuffer is null"))
                return
            }

            const bytes = new Uint8Array(arrayBuffer)
            const type = file.type

            resolve({ bytes, mimeType: type })
        }
        reader.onerror = error => {
            reject(error)
        }
        reader.readAsArrayBuffer(file)
    })
}

export async function getBytesFromUrl(url: URLString): Promise<FileInfo> {
    const response = await fetch(url)
    const blob = await response.blob()

    const type = response.headers.get("Content-Type")
    if (!type) {
        throw new Error("Unknown content type for url")
    }

    const bytes = await new Response(blob).arrayBuffer().then(buffer => new Uint8Array(buffer))

    return {
        mimeType: type,
        bytes,
    }
}
