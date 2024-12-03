import { Locale, LocalizationSource, LocalizationSourceId, LocalizedValuesUpdate } from "framer-plugin"
import "./App.css"

function escapeXml(unsafe: string): string {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
}

function generateUnit(source: LocalizationSource, targetLocale: Locale) {
    // TODO: expose localization's status to be able to set this correctly
    // See http://docs.oasis-open.org/xliff/xliff-core/v2.0/os/xliff-core-v2.0-os.html#state
    const state = source.valueLocalized[targetLocale.id]?.value ? "final" : `initial`

    const sourceValue = escapeXml(source.value)
    const targetValue = escapeXml(source.valueLocalized[targetLocale.id]?.value || "")

    return `        <unit id="${source.id}">
            <notes>
                <note category="type">${source.type}</note>
            </notes>
            <segment>
                <source>${sourceValue}</source>
                <target state="${state}">${targetValue}</target>
            </segment>
        </unit>`
}

export function generateXliff(defaultLocale: Locale, targetLocale: Locale, sources: readonly LocalizationSource[]) {
    const units = sources.map(source => generateUnit(source, targetLocale)).join("\n")

    return `<?xml version="1.0" encoding="UTF-8"?>
<xliff xmlns="urn:oasis:names:tc:xliff:document:2.0" version="2.0" srcLang="${defaultLocale.code}" trgLang="${targetLocale.code}">
    <file id="${targetLocale.id}" srcLang="${defaultLocale.code}" trgLang="${targetLocale.code}">
${units}
    </file>
</xliff>`
}

export function parseXliff(xliffText: string, locales: readonly Locale[]): { xliff: Document; targetLocale: Locale } {
    const parser = new DOMParser()
    const xliff = parser.parseFromString(xliffText, "text/xml")

    const file = xliff.querySelector("file")
    if (!file) throw new Error("No file element found in XLIFF")

    const targetLanguage = file.getAttribute("trgLang")
    if (!targetLanguage) throw new Error("No target language found in XLIFF")

    const targetLocale = locales.find(locale => locale.code === targetLanguage)
    if (!targetLocale) {
        throw new Error(`No locale found for language code: ${targetLanguage}`)
    }

    return { xliff: xliff, targetLocale }
}

export function createLocalizationsUpdateFromXliff(
    xliffDocument: Document,
    targetLocale: Locale
): Record<LocalizationSourceId, LocalizedValuesUpdate> {
    const update: Record<LocalizationSourceId, LocalizedValuesUpdate> = {}

    const units = xliffDocument.querySelectorAll("unit")
    for (const unit of units) {
        const id = unit.getAttribute("id")
        const target = unit.querySelector("target")?.textContent
        if (!id || !target) return

        const targetValue = target ? target : null
        update[id] = { [targetLocale.id]: targetValue }
    }

    return update
}
