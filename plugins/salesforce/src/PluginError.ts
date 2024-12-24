export type ErrorType = "auth"

export class PluginError extends Error {
    title: string
    type?: ErrorType

    constructor(title: string, message: string, type?: ErrorType) {
        super(message)

        Object.setPrototypeOf(this, PluginError.prototype)

        this.title = title
        this.type = type
    }
}
