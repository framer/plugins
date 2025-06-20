import { GreenhouseField } from "./data-source/types"

export function decodeHtml(html: string) {
    const textarea = document.createElement("textarea")
    textarea.innerHTML = html
    return textarea.value
}

export function createUniqueSlug(slug: string, id: string, existingSlugs: Set<string>) {
    if (!existingSlugs.has(slug)) {
        return slug
    }

    return `${slug}-${id}`
}

export function isCollectionReference(field: GreenhouseField) {
    return field.type === "collectionReference" || field.type === "multiCollectionReference"
}

export function isMissingReferenceField(field: GreenhouseField) {
    if (!isCollectionReference(field)) {
        return false
    }

    return !field.collectionId || field.supportedCollections?.length === 0
}
