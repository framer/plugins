import { clamp } from "./clamp"
import { Vector2 } from "./vector2"

export class Rect2 {
    position: Vector2 = new Vector2()
    size: Vector2 = new Vector2()

    constructor(x = 0, y = 0, width = 0, height = 0) {
        this.position = new Vector2(x, y)
        this.size = new Vector2(width, height)
    }

    intersection(b: Rect2): Rect2 | null {
        const rightA = this.position.x + this.size.x
        const bottomA = this.position.y + this.size.y

        const rightB = b.position.x + b.size.x
        const bottomB = b.position.y + b.size.y

        const maxLeft = Math.max(this.position.x, b.position.x)
        const minRight = Math.min(rightA, rightB)

        const maxTop = Math.max(this.position.y, b.position.y)
        const minBottom = Math.min(bottomA, bottomB)

        const x = maxLeft
        const y = maxTop
        const width = clamp(minRight - maxLeft, 0, Infinity)
        const height = clamp(minBottom - maxTop, 0, Infinity)

        const noOverlap = width === 0 || height === 0

        if (noOverlap) {
            return null
        }

        return new Rect2(x, y, width, height)
    }
}
