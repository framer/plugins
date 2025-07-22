import type { Locale } from "framer-plugin"

import { framer, useIsAllowedTo } from "framer-plugin"
import { useEffect, useState } from "react"
import "./App.css"
import { downloadBlob, importFileAsText } from "./files"
import { IconGlobe } from "./IconGlobe"
import { createValuesBySourceFromXliff, generateXliff, parseXliff } from "./xliff"

void framer.showUI({
    width: 260,
    height: 350,
})

function importXliff() {
    importFileAsText(".xlf,.xliff", async (xliffText: string) => {
        try {
            const locales = await framer.getLocales()

            const { xliff, targetLocale } = parseXliff(xliffText, locales)
            const valuesBySource = createValuesBySourceFromXliff(xliff, targetLocale)

            const result = await framer.setLocalizationData({ valuesBySource })

            if (result.valuesBySource.errors.length > 0) {
                throw new Error(`Import errors: ${result.valuesBySource.errors.map(error => error.error).join(", ")}`)
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
        const groups = await framer.getLocalizationGroups()
        const xliff = generateXliff(defaultLocale, targetLocale, groups)
        downloadBlob(xliff, filename, "application/x-xliff+xml")

        framer.notify(`Successfully exported ${filename}`)
    } catch (error) {
        console.error(error)
        framer.notify(`Error exporting ${filename}`, { variant: "error" })
    }
}

export function App() {
    const isAllowedToSetLocalizationData = useIsAllowedTo("setLocalizationData")

    const [selectedLocaleId, setSelectedLocaleId] = useState<string>("")
    const [locales, setLocales] = useState<readonly Locale[]>([])
    const [defaultLocale, setDefaultLocale] = useState<Locale | null>(null)

    useEffect(() => {
        async function loadLocales() {
            const initialLocales = await framer.getLocales()
            const initialDefaultLocale = await framer.getDefaultLocale()
            setLocales(initialLocales)
            setDefaultLocale(initialDefaultLocale)

            const activeLocale = await framer.getActiveLocale()
            if (activeLocale) {
                setSelectedLocaleId(activeLocale.id)
            }
        }

        void loadLocales()
    }, [])

    function handleExport() {
        if (!selectedLocaleId || !defaultLocale) return

        const targetLocale = locales.find(locale => locale.id === selectedLocaleId)
        if (!targetLocale) {
            throw new Error(`Could not find locale with id ${selectedLocaleId}`)
        }

        void exportXliff(defaultLocale, targetLocale)
    }

    return (
        <main>
            <div className="intro">
                <div className="asset">
                    <IconGlobe />
                </div>
                <div className="text">
                    <h4>Get Started</h4>
                    <p>Import and export localization strings into an external TMS system with XLIFF files.</p>
                </div>
            </div>

            <div className="button-stack">
                <button
                    type="button"
                    onClick={() => {
                        if (!isAllowedToSetLocalizationData) return
                        importXliff()
                    }}
                    disabled={!isAllowedToSetLocalizationData}
                    title={isAllowedToSetLocalizationData ? undefined : "Insufficient permissions"}
                >
                    Import
                </button>

                <button
                    type="button"
                    className="framer-button-primary"
                    onClick={handleExport}
                    disabled={!selectedLocaleId}
                >
                    Export
                </button>
            </div>
        </main>
    )
}
