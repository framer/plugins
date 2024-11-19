export class PluginError extends Error {
    constructor(
        public title: string,
        message: string
    ) {
        super(message)
        Object.setPrototypeOf(this, PluginError.prototype)
    }
}
