export function assert(condition: unknown, ...message: unknown[]): asserts condition {
    if (condition) return
    throw Error(`Assertion error: ${message.join(", ")}`)
}

export function assertNever(x: never): never {
    throw new Error(`Unexpected value: ${String(x)}`)
}
