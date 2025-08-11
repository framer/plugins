import type { PrCoField } from "./dataSources"

export function isCollectionReference(
    field: PrCoField
): field is Extract<PrCoField, { type: "collectionReference" | "multiCollectionReference" }> {
    return field.type === "collectionReference" || field.type === "multiCollectionReference"
}

export function isMissingReferenceField(field: PrCoField): boolean {
    if (!isCollectionReference(field)) {
        return false
    }

    return !field.collectionId || field.supportedCollections?.length === 0
}

export function assertNever(x: never, error?: unknown): never {
    throw error instanceof Error ? error : new Error(`Unexpected value: ${String(x)}`)
}
