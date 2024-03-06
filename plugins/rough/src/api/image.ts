import { PluginApi } from "./api"
import { assert, isString } from "./utils"

export type ImageId = string

export type URLString = string

export interface FramerImageUploadResult {
    /** A unique id. */
    id: ImageId
    /** Something that can be rendered within the iFrame. */
    url: string
    /** The original file width. */
    width: number
    /** The original file height. */
    height: number
}

export interface FramerImageData {
    /** Something that can be rendered within the iFrame. */
    url: string
    /** Optional name of the image */
    name?: string
}

interface Size {
    width: number
    height: number
}

export class FramerImage implements FramerImageData {
    readonly url: string

    #api: PluginApi

    constructor(data: FramerImageData, api: PluginApi) {
        this.url = data.url
        this.#api = api
    }

    async measure(): Promise<Size> {
        return measureImage(this.url)
    }

    /**
     * Get the data such as the bytes of the image.
     * The bytes can be used to manipulate the pixels of the image.
     */
    async getData(): Promise<ImageDataTransfer> {
        const data = await this.#api.getImageData(this)
        if (!data) {
            throw new Error("Failed to load image data")
        }

        return data
    }

    /**
     * Utility to create a HTMLImageElement from the image data returned by `getData`
     */
    static async imageFromData(data: ImageDataTransfer): Promise<HTMLImageElement> {
        const url = URL.createObjectURL(new Blob([data.bytes]))

        return new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image()
            img.onload = () => resolve(img)
            img.onerror = () => reject()
            img.src = url
        })
    }

    /**
     * Convenience method to load an image from a canvas.
     * As a transferable bytes array
     */
    static async bytesFromCanvas(canvas: HTMLCanvasElement): Promise<Uint8Array | null> {
        return new Promise<Uint8Array>((resolve, reject) => {
            canvas.toBlob(blob => {
                assert(blob)

                const reader = new FileReader()

                reader.onload = () => {
                    assert(reader.result)
                    resolve(new Uint8Array(reader.result as ArrayBuffer))
                }
                reader.onerror = () => reject(new Error("Could not read from blob"))
                reader.readAsArrayBuffer(blob)
            })
        })
    }
}

export type ImageInput = {
    name?: string
} & ({ file: File } | { url: string } | { data: ImageDataTransfer })

export interface ImageDataTransfer {
    /** The file data as RAW bytes. (UInt8Array) */
    bytes: Uint8Array
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

export async function createImageDataFromInput(input: ImageInput): Promise<ImageDataTransfer> {
    let transfer: ImageDataTransfer

    if ("file" in input && input.file instanceof File) {
        transfer = await getImageDataTransferFromFile(input.file)
    } else if ("url" in input && isValidUrl(input.url)) {
        transfer = await getImageDataTransferFromUrl(input.url)
    } else if ("data" in input && input.data) {
        transfer = input.data
    } else {
        throw new Error("Invalid image data")
    }

    return transfer
}

export async function getImageDataTransferFromFile(file: File): Promise<ImageDataTransfer> {
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

export async function getImageDataTransferFromUrl(url: URLString): Promise<ImageDataTransfer> {
    const response = await fetch(url)
    const blob = await response.blob()

    const type = response.headers.get("Content-Type")
    if (!type) {
        throw new Error("Unknown content-type for file at URL")
    }

    const bytes = await new Response(blob).arrayBuffer().then(buffer => new Uint8Array(buffer))

    return {
        mimeType: type,
        bytes,
    }
}

export async function measureImage(input: File | string): Promise<Size> {
    const isFileInput = input instanceof File
    const src = isFileInput ? URL.createObjectURL(input) : input

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = src

    await img.decode().finally(() => {
        if (isFileInput) URL.revokeObjectURL(src)
    })

    return {
        height: img.height,
        width: img.width,
    }
}
