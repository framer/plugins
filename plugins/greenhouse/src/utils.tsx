import type { GreenhouseField } from "./dataSources"

export function decodeHtml(html: string): string {
    const textarea = document.createElement("textarea")
    textarea.innerHTML = html
    return textarea.value
}

export function isCollectionReference(
    field: GreenhouseField
): field is Extract<GreenhouseField, { type: "collectionReference" | "multiCollectionReference" }> {
    return field.type === "collectionReference" || field.type === "multiCollectionReference"
}

export function isMissingReferenceField(field: GreenhouseField): boolean {
    if (!isCollectionReference(field)) {
        return false
    }

    return !field.collectionId || field.supportedCollections?.length === 0
}

export function assertNever(x: never, error?: unknown): never {
    throw error || new Error((x as unknown) ? `Unexpected value: ${x}` : "Application entered invalid state")
}
