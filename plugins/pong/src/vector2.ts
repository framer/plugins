// From: https://github.com/anthonyec/vector2

export class Vector2 {
    x: number
    y: number

    // Shorthand for common normalized directions and zero.
    static ZERO = new Vector2(0, 0)
    static UP = new Vector2(0, -1)
    static DOWN = new Vector2(0, 1)
    static LEFT = new Vector2(-1, 0)
    static RIGHT = new Vector2(1, 0)

    /**
     * Convert the mouse coordinates in a mouse event into a vector.
     */
    static fromMouseEvent(event: MouseEvent) {
        return new Vector2(event.offsetX, event.offsetY)
    }

    constructor(x = 0, y = 0) {
        this.x = x
        this.y = y
    }

    /**
     * Negates the vector.
     * */
    negate() {
        return new Vector2(-this.x, -this.y)
    }

    flipX() {
        return new Vector2(-this.x, this.y)
    }

    flipY() {
        return new Vector2(this.x, -this.y)
    }

    /**
     * Return the length of the vector.
     */
    magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y)
    }

    /**
     * Returns the vector with it's magnitude scaled by an arbitrary amount.
     */
    scale(scalar: number) {
        return new Vector2(this.x * scalar, this.y * scalar)
    }

    /**
     * Returns the vector scaled to unit length, always having a length of one.
     */
    normalize() {
        const magnitude = this.magnitude()

        // TODO: Describe **why** 1e-9 is used instead of zero.
        // Might be to do something with rounding error:
        // https://www.geeksforgeeks.org/problem-in-comparing-floating-point-numbers-and-how-to-compare-them-correctly/
        if (Math.abs(magnitude) < 1e-9) {
            return new Vector2(0, 0)
        } else {
            return new Vector2(this.x / magnitude, this.y / magnitude)
        }
    }

    /**
     * Add two vectors together.
     */
    add(b: Vector2) {
        return new Vector2(this.x + b.x, this.y + b.y)
    }

    /**
     * Subtract two vectors from each other.
     */
    sub(b: Vector2) {
        return new Vector2(this.x - b.x, this.y - b.y)
    }

    /**
     * Returns the distance between two vectors.
     */
    distanceTo(b: Vector2) {
        return Math.sqrt(this.distanceSquaredTo(b))
    }

    /**
     * Returns the squared distance between two vectors.
     *
     * This method runs faster than `distanceTo`, so use it when you are comparing
     * vectors or need the squared distance for a formula.
     */
    distanceSquaredTo(b: Vector2) {
        const difference = this.sub(b)
        return difference.x * difference.x + difference.y * difference.y
    }

    /**
     * Returns a vector that is rotated 90 degrees counter-clockwise to the
     * original.
     */
    perpendicular() {
        return new Vector2(this.y, -this.x)
    }

    angle(): number {
        return Math.atan2(this.y, this.x)
    }

    angleTo(b: Vector2) {
        return b.angle() - this.angle()
    }

    angleBetween(b: Vector2) {
        const dot = this.dot(b)
        const magnitudeProduct = this.magnitude() * b.magnitude()
        return Math.acos(dot / magnitudeProduct)
    }

    dot(b: Vector2) {
        return this.x * b.x + this.y * b.y
    }

    /**
     * Interpolate between two vectors.
     */
    lerp(b: Vector2, weight: number) {
        return new Vector2(this.x + (b.x - this.x) * weight, this.y + (b.y - this.y) * weight)
    }

    /**
     * Returns the vector rotated by an angle in radians.
     */
    rotated(angle: number) {
        const sin = Math.sin(angle)
        const cos = Math.cos(angle)

        return new Vector2(this.x * cos - this.y * sin, this.x * sin + this.y * cos)
    }

    abs() {
        return new Vector2(Math.abs(this.x), Math.abs(this.y))
    }

    toFixed(fractionDigits?: number) {
        const x = this.x.toFixed(fractionDigits)
        const y = this.y.toFixed(fractionDigits)

        return `(${x}, ${y})`
    }

    toString() {
        return `(${this.x}, ${this.y})`
    }
}
