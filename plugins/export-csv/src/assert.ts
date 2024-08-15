export function assertNever(x: never, error?: unknown): never {
  throw error || new Error((x as unknown) ? `Unexpected value: ${x}` : "Application entered invalid state")
}
