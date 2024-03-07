import { expose, transfer } from "comlink"


export class CanvasWorker {
    private offscreenCanvas: OffscreenCanvas
    private ctx: OffscreenCanvasRenderingContext2D

    constructor() {
        this.offscreenCanvas = new OffscreenCanvas(0, 0)
        const ctx = this.offscreenCanvas.getContext("2d")

        if (!ctx) {
            throw new Error("WTF")
        }

        this.ctx = ctx
    }

    async draw(bitmap: ImageBitmap, threshold: number) {
        const { width, height } = bitmap

        this.offscreenCanvas.width = width
        this.offscreenCanvas.height = height

        const ctx = this.ctx

        // Draw the ImageBitmap onto the canvas
        ctx.drawImage(bitmap, 0, 0)

        const imageData = ctx.getImageData(0, 0, width, height)

        if (!imageData) return

        const imgData = imageData.data

        for (let i = 0; i < imgData.length; i += 4) {
            const grayscale = imgData[i] * 0.3 + imgData[i + 1] * 0.59 + imgData[i + 2] * 0.11
            const binaryColor = grayscale < threshold ? 0 : 255
            imgData[i] = imgData[i + 1] = imgData[i + 2] = binaryColor
        }

        ctx.putImageData(imageData, 0, 0)

        const nextData = this.ctx.getImageData(0, 0, width, height)

        const resultBitmap = await createImageBitmap(nextData)

        return transfer(resultBitmap, [resultBitmap])
    }
}

expose(CanvasWorker, self)
