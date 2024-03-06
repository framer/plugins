import type { PluginApi } from "./api"
import { isObject, isString } from "./utils"

export type PluginImageId = string

export interface PluginImageIdentifier {
    /**
     * A unique ID that identifies the image
     */
    id: PluginImageId
}

export interface PluginImageData extends PluginImageIdentifier {
    /** Something that can be rendered within the iFrame. Always the original size of the image */
    url: string
    /**
     * Thumbnail URL of the image.
     */
    thumbnailUrl: string
    /** Optional name of the image */
    name?: string
}

interface Size {
    width: number
    height: number
}

export class PluginImage implements PluginImageData, PluginImageIdentifier {
    readonly id: PluginImageId
    readonly url: string
    readonly thumbnailUrl: string

    #imageData: ImageDataTransfer | undefined

    #api: PluginApi

    constructor(data: PluginImageData, api: PluginApi) {
        this.url = data.url
        this.#api = api
        this.id = data.id
        this.thumbnailUrl = data.thumbnailUrl
    }

    async measure(): Promise<Size> {
        return measureImage(this.url)
    }

    /**
     * Get the data such as the bytes of the image.
     * The bytes can be used to manipulate the pixels of the image.
     */
    async getData(): Promise<ImageDataTransfer> {
        if (
            this.#imageData &&
            // When data is transfered over postMessage (instead of the structured clone, which is default)
            // The array buffer becomes empty on the sending side.
            // In these cases we need to load the bytes again.
            this.#imageData.bytes.length > 0
        ) {
            return this.#imageData
        }

        const data = await this.#api.getImageData({
            id: this.id,
        })

        if (!data) {
            throw new Error("Failed to load image data")
        }

        this.#imageData = data

        return data
    }

    async loadBitmap() {
        const image = await this.loadImage()

        return createImageBitmap(image)
    }

    async loadImage(): Promise<HTMLImageElement> {
        const data = await this.getData()
        const url = URL.createObjectURL(new Blob([data.bytes]))

        return new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image()
            img.onload = () => resolve(img)
            img.onerror = () => reject()
            img.src = url
        })
    }
}

export type PluginImageInput = string | File | ImageDataTransfer

export interface ImageInputOptions {
    name?: string
}

export interface ImageDataTransfer {
    /** The file data as RAW bytes. (UInt8Array) */
    bytes: Uint8Array
    /* The mime type of the image file */
    mimeType: string
}

export interface SVGData {
    /** The SVG data as a string. */
    svg: string
    /** The file name. */
    name?: string
}

function isImageDataTransfer(input: PluginImageInput): input is ImageDataTransfer {
    if (!isObject(input)) return false
    if (!(input.bytes instanceof Uint8Array)) return false
    if (!isString(input.mimeType)) return false

    return true
}

export async function createImageDataFromInput(input: PluginImageInput): Promise<ImageDataTransfer> {
    if (isImageDataTransfer(input)) {
        return input
    }

    if (input instanceof File) {
        return getImageDataFromFile(input)
    }

    return getImageDataFromUrl(input)
}

function assertIsImageMimeType(mimeType: string) {
    if (!mimeType.startsWith("image/")) {
        throw new Error(`Unsupported mime type: ${mimeType}`)
    }
}

/**
 *  Returns the bytes bytes and mime type of a file from a given File object
 */
export async function getImageDataFromFile(file: File): Promise<ImageDataTransfer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = event => {
            const type = file.type

            // TODO: Video and other files?
            assertIsImageMimeType(file.type)

            const arrayBuffer = event.target?.result
            if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) {
                reject(new Error("Failed to read file, arrayBuffer is null"))
                return
            }

            const bytes = new Uint8Array(arrayBuffer)

            resolve({ bytes, mimeType: type })
        }
        reader.onerror = error => {
            reject(error)
        }
        reader.readAsArrayBuffer(file)
    })
}

/**
 * Returns the bytes and mime type of an image a given URL.
 */
export async function getImageDataFromUrl(url: string): Promise<ImageDataTransfer> {
    const response = await fetch(url)
    const blob = await response.blob()

    const type = response.headers.get("Content-Type")
    if (!type) {
        throw new Error("Unknown content-type for file at URL")
    }

    // TODO: Video? File? Avoid reading bytes for any kind of file.
    assertIsImageMimeType(type)

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
