import { framer, Locale } from "framer-plugin"
import { useEffect, useState } from "react"
import "./App.css"
import { downloadBlob, importFileAsText } from "./files"
import { createLocalizationsUpdateFromXliff, generateXliff, parseXliff } from "./xliff"

framer.showUI({
    width: 300,
    height: 152,
})

async function importXliff() {
    importFileAsText(".xlf,.xliff", async (xliffText: string) => {
        try {
            const locales = await framer.unstable_getLocales()

            const { xliff, targetLocale } = parseXliff(xliffText, locales)
            const update = createLocalizationsUpdateFromXliff(xliff, targetLocale)

            const result = await framer.unstable_setLocalizedValues(update)

            if (result.errors.length > 0) {
                throw new Error(`Import errors: ${result.errors.map(error => error.error).join(", ")}`)
            }

            framer.notify(`Successfully imported localizations for ${targetLocale.name}`)
        } catch (error) {
            console.error(error)
            framer.notify(error instanceof Error ? error.message : "Error importing XLIFF file", { variant: "error" })
        }
    })
}

async function exportXliff(defaultLocale: Locale, targetLocale: Locale) {
    const filename = `localizations_${targetLocale.code}.xlf`

    try {
        const sources = await framer.unstable_getLocalizationSources()
        const xliff = generateXliff(defaultLocale, targetLocale, sources)
        downloadBlob(xliff, filename, "application/x-xliff+xml")

        framer.notify(`Successfully exported ${filename}`)
    } catch (error) {
        console.error(error)
        framer.notify(`Error exporting ${filename}`, { variant: "error" })
    }
}

export function App() {
    const [selectedLocaleId, setSelectedLocaleId] = useState<string>("")
    const [locales, setLocales] = useState<readonly Locale[]>([])
    const [defaultLocale, setDefaultLocale] = useState<Locale | null>(null)

    useEffect(() => {
        async function loadLocales() {
            const initialLocales = await framer.unstable_getLocales()
            const initialDefaultLocale = await framer.unstable_getDefaultLocale()
            setLocales(initialLocales)
            setDefaultLocale(initialDefaultLocale)

            const firstLocale = initialLocales[0]
            if (!firstLocale) return
            setSelectedLocaleId(firstLocale.id)
        }

        loadLocales()
    }, [])

    async function handleExport() {
        if (!selectedLocaleId || !defaultLocale) return

        const targetLocale = locales.find(locale => locale.id === selectedLocaleId)
        if (!targetLocale) {
            throw new Error(`Could not find locale with id ${selectedLocaleId}`)
        }

        exportXliff(defaultLocale, targetLocale)
    }

    return (
        <main>
            <button className="framer-button-primary" onClick={importXliff}>
                Import XLIFF
            </button>

            <hr />

            <select
                value={selectedLocaleId}
                onChange={e => setSelectedLocaleId(e.target.value)}
                disabled={!selectedLocaleId}
            >
                {locales.map(locale => (
                    <option key={locale.id} value={locale.id}>
                        {locale.name} ({locale.code})
                    </option>
                ))}
            </select>

            <button className="framer-button-primary" onClick={handleExport} disabled={!selectedLocaleId}>
                Export XLIFF
            </button>
        </main>
    )
}
