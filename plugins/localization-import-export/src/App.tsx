import type { Locale } from "framer-plugin"

import { framer } from "framer-plugin"
import { useEffect, useState } from "react"
import "./App.css"
import { downloadBlob, importFileAsText } from "./files"
import { createLocalizationsUpdateFromXliff, generateXliff, parseXliff } from "./xliff"

framer.showUI({
    width: 300,
    height: 350,
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
    const filename = `locale_${targetLocale.code}.xlf`

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

    const selectedLocale = locales.find(locale => locale.id === selectedLocaleId)

    useEffect(() => {
        async function loadLocales() {
            const initialLocales = await framer.unstable_getLocales()
            const initialDefaultLocale = await framer.unstable_getDefaultLocale()
            setLocales(initialLocales)
            setDefaultLocale(initialDefaultLocale)

            const activeLocale = await framer.unstable_getActiveLocale()
            if (activeLocale) {
                setSelectedLocaleId(activeLocale.id)
            }
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
            <div className="asset">
                <svg xmlns="http://www.w3.org/2000/svg" width="74" height="74">
                    <path
                        d="M 37 2.313 C 56.157 2.313 71.688 17.843 71.688 37 C 71.688 56.157 56.157 71.688 37 71.688 C 17.843 71.688 2.313 56.157 2.313 37 C 2.313 17.843 17.843 2.313 37 2.313 Z M 11.563 37 C 11.563 47.692 18.159 56.843 27.504 60.606 C 24.809 54.7 23.125 46.309 23.125 37 C 23.125 27.691 24.809 19.3 27.504 13.394 C 18.159 17.157 11.563 26.308 11.563 37 Z M 62.438 37 C 62.438 26.308 55.841 17.157 46.496 13.394 C 49.191 19.3 50.875 27.691 50.875 37 C 50.875 46.309 49.191 54.7 46.496 60.606 C 55.841 56.843 62.438 47.692 62.438 37 Z M 30.063 37 C 30.063 51.049 33.169 62.438 37 62.438 C 40.831 62.438 43.938 51.049 43.938 37 C 43.938 22.951 40.831 11.563 37 11.563 C 33.169 11.563 30.063 22.951 30.063 37 Z"
                        fill="currentColor"
                    ></path>
                    <path
                        d="M 6.937 34.688 L 6.938 34.688 C 26.719 39.253 47.281 39.253 67.063 34.688 L 67.063 34.688"
                        fill="transparent"
                        strokeWidth="7"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    ></path>
                </svg>
            </div>
            <p>
                Import and export your Localization strings with embedded metadata into an external TMS system with
                standardized XLIFF files.
            </p>

            <div className="button-stack">
                <button type="button" onClick={importXliff}>
                    Import {selectedLocale?.name}
                </button>

                <button
                    type="button"
                    className="framer-button-primary"
                    onClick={handleExport}
                    disabled={!selectedLocaleId}
                >
                    Export {selectedLocale?.name}
                </button>
            </div>
        </main>
    )
}
