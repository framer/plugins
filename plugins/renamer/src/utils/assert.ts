export function assert(condition: unknown, ...message: unknown[]): asserts condition {
    if (condition) return
    throw Error(`Assertion error: ${message.join(", ")}`)
}

export function assertNever(x: never, error?: unknown): never {
    throw error || new Error((x as unknown) ? `Unexpected value: ${x}` : "Application entered invalid state")
}
