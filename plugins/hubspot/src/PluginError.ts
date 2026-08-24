export class PluginError extends Error {
    constructor(
        public title: string,
        message: string,
        public status?: number
    ) {
        super(message)
        Object.setPrototypeOf(this, PluginError.prototype)
    }
}
