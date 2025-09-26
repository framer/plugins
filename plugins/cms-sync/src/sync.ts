// Optional global flag you can flip in DevTools: window.__CMS_SYNC_DEBUG__ = true
declare global {
   
  interface Window {
    __CMS_SYNC_DEBUG__?: boolean
  }
}

const DEBUG: boolean =
  typeof window !== "undefined" && !!window.__CMS_SYNC_DEBUG__

import type { Collection, CollectionItem, Field, FieldDataEntryInput, FieldDataInput } from "framer-plugin"
import { framer } from "framer-plugin"

export function readRawFieldValue(item: CollectionItem, fieldId: string | undefined): unknown {
    if (!fieldId) return undefined
    const data = (item as unknown as { fieldData?: Record<string, unknown> }).fieldData
    return data?.[fieldId]
}

export async function buildReferenceSlugMap(dstFields: Field[]): Promise<Map<string, Map<string, string>>> {
    const all = new Map<string, Map<string, string>>()
    const refIds = new Set<string>()
    for (const f of dstFields) {
        if ((f.type === "collectionReference" || f.type === "multiCollectionReference") && f.collectionId) {
            refIds.add(f.collectionId)
        }
    }
    for (const colId of refIds) {
        const col: Collection | null = await framer.getCollection(colId)
        if (!col) continue
        const items = await col.getItems()
        const map = new Map<string, string>()
        for (const it of items) map.set(it.slug, it.id)
        all.set(colId, map)
    }
    return all
}

function isCompatible(src: Field, dst: Field): boolean {
    if (src.type === dst.type) return true
    if (src.type === "string") {
        return (
            dst.type === "image" ||
            dst.type === "file" ||
            dst.type === "link" ||
            dst.type === "color" ||
            dst.type === "formattedText" ||
            dst.type === "enum" ||
            dst.type === "collectionReference" ||
            dst.type === "multiCollectionReference"
        )
    }
    return false
}

export function toFieldDataEntryInputForField(dstField: Field, raw: unknown): FieldDataEntryInput | undefined {
    switch (dstField.type) {
        case "string": {
            const v = normalizeString(raw)
            return v === undefined ? undefined : { type: "string", value: v }
        }
        case "formattedText": {
            const v = normalizeFormattedText(raw)
            return v === undefined ? undefined : { type: "formattedText", value: v }
        }
        case "number": {
            const n = normalizeNumber(raw)
            return n === undefined ? undefined : { type: "number", value: n }
        }
        case "boolean": {
            const b = normalizeBoolean(raw)
            return b === undefined ? undefined : { type: "boolean", value: b }
        }
        case "date": {
            const d = normalizeDate(raw)
            return d === undefined ? undefined : { type: "date", value: d }
        }
        case "enum": {
            const id = normalizeEnumCaseId(raw)
            return id === undefined ? undefined : { type: "enum", value: id }
        }
        case "color": {
            const v = normalizeString(raw) ?? null
            return { type: "color", value: v }
        }
        case "link": {
            const v = normalizeLinkValue(raw)
            return { type: "link", value: v }
        }
        case "file": {
            const v = normalizeFileOrImageValue(raw)
            return { type: "file", value: v }
        }
        case "image": {
            const img = normalizeFileOrImageValue(raw)
            const alt = normalizeImageAlt(raw)
            return { type: "image", value: img, alt }
        }
        case "collectionReference": {
            const id = normalizeSingleReferenceId(raw)
            return { type: "collectionReference", value: id ?? null }
        }
        case "multiCollectionReference": {
            const ids = normalizeMultiReferenceIds(raw)
            return { type: "multiCollectionReference", value: ids ?? null }
        }
        case "array":
        case "divider":
        case "unsupported":
            return undefined
        default: {
            dstField satisfies never
            return undefined
        }
    }
}

export function buildFieldDataForItem(
    dstFields: Field[],
    mapping: Record<string, string | undefined>,
    srcItem: CollectionItem,
    srcFieldsById: Map<string, Field>,
    refSlugMap: Map<string, Map<string, string>>
): FieldDataInput {
    const fieldData: FieldDataInput = {}

    for (const dst of dstFields) {
        const srcId = mapping[dst.id]
        if (!srcId) continue

        const srcField = srcFieldsById.get(srcId)
        if (!srcField) continue

        if (!isCompatible(srcField, dst)) continue

        let raw = readRawFieldValue(srcItem, srcId)

        // Debug trace for image values
        if (dst.type === "image") {
            if (DEBUG) console.log("[CMS Sync] Image raw value for", dst.name, "=>", raw);
        }

        // Reference slug -> id conversion
        if (dst.type === "collectionReference" && dst.collectionId) {
            const bySlug = refSlugMap.get(dst.collectionId)
            if (typeof raw === "string") {
                raw = bySlug?.get(raw.trim()) ?? null
            } else if (typeof raw === "object" && raw) {
                const r = raw as Record<string, unknown>
                if (typeof r.id === "string") {
                    raw = r.id
                } else if (typeof r.value === "string") {
                    raw = bySlug?.get(r.value.trim()) ?? null
                } else {
                    raw = null
                }
            }
        } else if (dst.type === "multiCollectionReference" && dst.collectionId) {
            const bySlug = refSlugMap.get(dst.collectionId)
            if (typeof raw === "string") {
                const ids = raw
                    .split(",")
                    .map(s => s.trim())
                    .map(slug => bySlug?.get(slug))
                    .filter((v): v is string => typeof v === "string")
                raw = ids.length ? ids : null
            } else if (Array.isArray(raw)) {
                const ids = raw
                    .map((v): string | undefined => {
                        if (typeof v === "string") return bySlug?.get(v.trim())
                        if (typeof v === "object" && v) {
                            const r = v as Record<string, unknown>
                            if (typeof r.id === "string") return r.id
                            if (typeof r.value === "string") return bySlug?.get(r.value.trim())
                        }
                        return undefined
                    })
                    .filter((v): v is string => typeof v === "string")
                raw = ids.length ? ids : null
            } else if (typeof raw === "object" && raw) {
                const r = raw as Record<string, unknown>
                if (Array.isArray(r.value)) {
                    const ids = (r.value as unknown[])
                        .map((v): string | undefined => {
                            if (typeof v === "string") return bySlug?.get(v.trim())
                            if (typeof v === "object" && v) {
                                const o = v as Record<string, unknown>
                                if (typeof o.id === "string") return o.id
                                if (typeof o.value === "string") return bySlug?.get(o.value.trim())
                            }
                            return undefined
                        })
                        .filter((v): v is string => typeof v === "string")
                    raw = ids.length ? ids : null
                }
            }
        }

        const entry = toFieldDataEntryInputForField(dst, raw)

        if (dst.type === "image") {
            if (DEBUG) console.log("[CMS Sync] Image normalized entry for", dst.name, "=>", entry);
        }

        if (entry !== undefined) {
            fieldData[dst.id] = entry
        }
    }

    return fieldData
}

/* ----------------------- Normalizers ----------------------- */

function normalizeString(raw: unknown): string | undefined {
    if (typeof raw === "string") return raw
    if (raw == null) return undefined
    if (typeof raw === "object") {
        const r = raw as Record<string, unknown>
        if (typeof r.value === "string") return r.value
        if (typeof r.text === "string") return r.text
    }
    if (typeof raw === "number" || typeof raw === "boolean") return String(raw)
    return undefined
}

function normalizeFormattedText(raw: unknown): string | undefined {
    if (typeof raw === "string") return raw
    if (typeof raw === "object") {
        const r = raw as Record<string, unknown>
        if (typeof r.value === "string") return r.value
        if (typeof r.html === "string") return r.html
        if (typeof r.text === "string") return r.text
    }
    return undefined
}

function normalizeNumber(raw: unknown): number | undefined {
    if (typeof raw === "number" && Number.isFinite(raw)) return raw
    if (typeof raw === "string" && raw.trim() !== "") {
        const n = Number(raw)
        return Number.isFinite(n) ? n : undefined
    }
    if (typeof raw === "object") {
        const v = (raw as Record<string, unknown>).value
        if (typeof v === "number" && Number.isFinite(v)) return v
    }
    return undefined
}

function normalizeBoolean(raw: unknown): boolean | undefined {
    if (typeof raw === "boolean") return raw
    if (typeof raw === "string") {
        const v = raw.trim().toLowerCase()
        if (v === "true" || v === "1" || v === "yes" || v === "y") return true
        if (v === "false" || v === "0" || v === "no" || v === "n") return false
    }
    if (typeof raw === "object") {
        const v = (raw as Record<string, unknown>).value
        if (typeof v === "boolean") return v
    }
    return undefined
}

function normalizeDate(raw: unknown): string | undefined {
    if (typeof raw === "string" && raw) {
        const d = new Date(raw)
        if (!Number.isNaN(d.getTime())) return d.toISOString().split("T")[0]
    }
    if (raw instanceof Date) return raw.toISOString().split("T")[0]
    if (typeof raw === "object") {
        const v = (raw as Record<string, unknown>).value
        if (typeof v === "string" && v) {
            const d = new Date(v)
            if (!Number.isNaN(d.getTime())) return d.toISOString().split("T")[0]
        }
    }
    return undefined
}

function normalizeEnumCaseId(raw: unknown): string | undefined {
    if (typeof raw === "string" && raw) return raw
    if (typeof raw === "object") {
        const r = raw as Record<string, unknown>
        if (typeof r.id === "string") return r.id
        if (typeof r.value === "string") return r.value
    }
    return undefined
}

function normalizeLinkValue(raw: unknown): string | null {
    const s = normalizeString(raw)
    if (s === undefined) return null
    return s.trim() || null
}

function normalizeFileOrImageValue(raw: unknown): string | null {
    if (raw == null) return null
    if (typeof raw === "string") return raw.trim() || null

    if (typeof raw === "object") {
        const r = raw as Record<string, unknown>

        // 1) direct url-like
        const urlLike =
            (typeof r.url === "string" && r.url) ||
            (typeof r.src === "string" && r.src) ||
            (typeof r.value === "string" && r.value)

        if (typeof urlLike === "string" && urlLike.trim() !== "") {
            return urlLike.trim()
        }

        // 2) nested value object with url/id/src
        if (typeof r.value === "object" && r.value) {
            const v = r.value as Record<string, unknown>
            const nestedUrl = (typeof v.url === "string" && v.url) || (typeof v.src === "string" && v.src)
            if (typeof nestedUrl === "string" && nestedUrl.trim() !== "") {
                return nestedUrl.trim()
            }
            if (typeof v.id === "string" && v.id.trim() !== "") {
                return v.id.trim()
            }
        }

        // 3) asset id
        if (typeof r.id === "string" && r.id.trim() !== "") {
            return r.id.trim()
        }
    }

    return null
}

function normalizeImageAlt(raw: unknown): string | undefined {
    if (typeof raw === "object" && raw) {
        const r = raw as Record<string, unknown>
        if (typeof r.alt === "string") return r.alt
        if (typeof r.altText === "string") return r.altText

        const v = r.value
        if (typeof v === "object" && v && typeof (v as Record<string, unknown>).alt === "string") {
            return (v as Record<string, unknown>).alt as string
        }
    }
    return undefined
}

function normalizeSingleReferenceId(raw: unknown): string | null | undefined {
    if (raw == null) return null
    if (typeof raw === "string") return raw || null
    if (typeof raw === "object") {
        const r = raw as Record<string, unknown>
        if (typeof r.id === "string") return r.id
        if (typeof r.value === "string") return r.value
    }
    return undefined
}

function normalizeMultiReferenceIds(raw: unknown): string[] | null | undefined {
    if (raw == null) return null
    if (Array.isArray(raw)) {
        const ids = raw
            .map((v: unknown): string | undefined => {
                if (typeof v === "string") return v
                if (typeof v === "object" && v) {
                    const r = v as Record<string, unknown>
                    if (typeof r.id === "string") return r.id
                    if (typeof r.value === "string") return r.value
                }
                return undefined
            })
            .filter((x): x is string => typeof x === "string")
        return ids.length ? ids : null
    }
    if (typeof raw === "object") {
        const r = raw as Record<string, unknown>
        if (Array.isArray(r.value)) return normalizeMultiReferenceIds(r.value)
    }
    if (typeof raw === "string") {
        const ids = raw
            .split(",")
            .map(s => s.trim())
            .filter(Boolean)
        return ids.length ? ids : null
    }
    return undefined
}