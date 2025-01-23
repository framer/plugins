import type { Locale, LocalizationGroup, LocalizationSource, LocalizedValuesUpdate } from "framer-plugin"
import "./App.css"
import { shouldBeNever } from "./assert"

function escapeXml(unsafe: string): string {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
}

/** See http://docs.oasis-open.org/xliff/xliff-core/v2.0/os/xliff-core-v2.0-os.html#state */
type XliffState = "initial" | "translated" | "reviewed" | "final"
type FramerStatus = LocalizationSource["locales"][Locale["id"]]["status"]

function statusToXliffState(status: FramerStatus): XliffState | undefined {
    switch (status) {
        case "new":
            return "initial"
        case "needsReview":
            return "translated"
        case "warning":
        case "done":
            return "final"
        default:
            shouldBeNever(status)
            return
    }
}

function xliffStateToStatus(state: XliffState): FramerStatus | undefined {
    switch (state) {
        case "initial":
            return "new"
        case "translated":
            return "needsReview"
        case "reviewed":
        case "final":
            return "done"
        default:
            shouldBeNever(state)
            return
    }
}

function generateUnit(source: LocalizationSource, targetLocale: Locale) {
    const localeData = source.locales[targetLocale.id]
    if (!localeData) {
        throw new Error(`No locale data found for locale: ${targetLocale.id}`)
    }

    const state = statusToXliffState(localeData.status)

    const sourceValue = escapeXml(source.value)
    const targetValue = escapeXml(localeData.value ?? "")

    const notes = [`<note category="type">${source.type}</note>`]

    if (localeData.status === "warning") {
        notes.push(`<note category="warning">${escapeXml(localeData.warning)}</note>`)
    }

    if (localeData.status !== "new") {
        notes.push(`<note category="lastEdited">${localeData.lastEdited}</note>`)
    }

    return `            <unit id="${source.id}">
                <notes>
                    ${notes.join("\n                    ")}
                </notes>
                <segment state="${state}"${localeData.status === "warning" ? ` subState="framer:warning"` : ""}>
                    <source>${sourceValue}</source>
                    <target>${targetValue}</target>
                </segment>
            </unit>`
}

export function generateGroup(localizationGroup: LocalizationGroup, targetLocale: Locale) {
    const units = localizationGroup.sources.map(source => generateUnit(source, targetLocale))

    return `        <group id="${localizationGroup.id}">
            <notes>
                <note category="type">${localizationGroup.type}</note>
                <note category="name">${escapeXml(localizationGroup.name)}</note>
            </notes>
${units.join("\n")}
        </group>`
}

export function generateXliff(
    defaultLocale: Locale,
    targetLocale: Locale,
    localizationGroups: readonly LocalizationGroup[]
) {
    const groups = localizationGroups.map(localizationGroup => generateGroup(localizationGroup, targetLocale))

    return `<?xml version="1.0" encoding="UTF-8"?>
<xliff xmlns="urn:oasis:names:tc:xliff:document:2.0" version="2.0" srcLang="${defaultLocale.code}" trgLang="${targetLocale.code}">
    <file id="${targetLocale.id}">
${groups.join("\n")}
    </file>
</xliff>`
}

export function parseXliff(xliffText: string, locales: readonly Locale[]): { xliff: Document; targetLocale: Locale } {
    const parser = new DOMParser()
    const xliff = parser.parseFromString(xliffText, "text/xml")

    const xliffElement = xliff.querySelector("xliff")
    if (!xliffElement) throw new Error("No xliff element found in XLIFF")

    const targetLanguage = xliffElement.getAttribute("trgLang")
    if (!targetLanguage) throw new Error("No target language found in XLIFF")

    const targetLocale = locales.find(locale => locale.code === targetLanguage)
    if (!targetLocale) {
        throw new Error(`No locale found for language code: ${targetLanguage}`)
    }

    return { xliff: xliff, targetLocale }
}

export function createValuesBySourceFromXliff(xliffDocument: Document, targetLocale: Locale): LocalizedValuesUpdate {
    const valuesBySource: LocalizedValuesUpdate = {}

    const units = xliffDocument.querySelectorAll("unit")
    for (const unit of units) {
        const id = unit.getAttribute("id")
        const segment = unit.querySelector("segment")
        const target = unit.querySelector("target")
        if (!id || !target || !segment) continue

        const targetValue = target.textContent
        const state = segment.getAttribute("state") as XliffState | null
        const status = xliffStateToStatus(state ?? "final")
        const needsReview = status === "needsReview"

        // Ignore missing or empty values
        if (!targetValue) continue

        valuesBySource[id] = {
            [targetLocale.id]: {
                action: "set",
                value: targetValue,
                needsReview: needsReview ? needsReview : undefined,
            },
        }
    }

    return valuesBySource
}
