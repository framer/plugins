import { framer } from "framer-plugin"
import "./App.css"
import { downloadBlob, importFileAsText } from "./files"
import { IconRedirects } from "./IconRedirects"
import { generateCsv, normalizeRedirectInputs, parseCSV } from "./csv"

framer.showUI({
    width: 260,
    height: 350,
})

async function importCsv() {
    importFileAsText(".csv", async (csv: string) => {
        try {
            const parsedRedirects = parseCSV(csv)

            if (parsedRedirects.length === 0) {
                throw new Error("CSV was empty")
            }

            const redirectInputs = await normalizeRedirectInputs(parsedRedirects)
            await framer.unstable_addRedirects(redirectInputs)

            framer.notify(`Successfully imported ${redirectInputs.length} redirects`)
        } catch (error) {
            console.error(error)
            framer.notify(error instanceof Error ? error.message : "Error importing CSV file", {
                variant: "error",
                durationMs: 10000,
            })
        }
    })
}

async function exportCsv() {
    const filename = "redirects.csv"

    try {
        const redirects = await framer.unstable_getRedirects()
        const csv = generateCsv(redirects)
        downloadBlob(csv, filename, "text/csv")

        framer.notify(`Successfully exported ${filename}`)
    } catch (error) {
        console.error(error)
        framer.notify(`Error exporting ${filename}`, { variant: "error" })
    }
}

export function App() {
    return (
        <main>
            <div className="intro">
                <div className="asset">
                    <IconRedirects />
                </div>
                <div className="text">
                    <h4>Get Started</h4>
                    <p>Import and export project redirects using CSV files.</p>
                </div>
            </div>

            <div className="button-stack">
                <button type="button" onClick={importCsv}>
                    Import
                </button>

                <button type="button" className="framer-button-primary" onClick={exportCsv}>
                    Export
                </button>
            </div>
        </main>
    )
}
