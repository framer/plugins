import { framer, useIsAllowedTo } from "framer-plugin"
import { useEffect } from "react"
import "./App.css"
import { countAndRemoveMissingRedirects, generateCsv, normalizeRedirectInputs, parseCSV } from "./csv"
import { downloadBlob, importFileAsText } from "./files"
import { IconRedirects } from "./IconRedirects"

const learnMoreLink = "https://www.framer.com/help/articles/bulk-importing-exporting-redirects/"

framer.showUI({
    width: 260,
    height: 370,
})

function checkPermissions() {
    const isAllowedToAddRedirects = framer.isAllowedTo("addRedirects")

    if (!isAllowedToAddRedirects) {
        framer.notify("You do not have permissions to add redirects", { variant: "error" })
        return false
    }

    return true
}

async function handleImport(csv: string) {
    try {
        const parsedRedirects = parseCSV(csv)

        if (parsedRedirects.length === 0) {
            throw new Error("CSV was empty")
        }

        const nonMissingRedirects = countAndRemoveMissingRedirects(parsedRedirects)
        const totalMissingRedirects = parsedRedirects.length - nonMissingRedirects.length

        const redirectInputs = await normalizeRedirectInputs(nonMissingRedirects)
        await framer.addRedirects(redirectInputs)

        framer.notify(
            `Successfully imported ${redirectInputs.length} redirect${redirectInputs.length !== 1 ? "s" : ""}${
                totalMissingRedirects > 0
                    ? `. Skipped ${totalMissingRedirects} missing redirect${totalMissingRedirects !== 1 ? "s" : ""}.`
                    : ""
            }`
        )
    } catch (error) {
        console.error(error)
        framer.notify(error instanceof Error ? error.message : "Error importing CSV file", {
            variant: "error",
            durationMs: 10000,
        })
    }
}

async function importCsv() {
    if (!checkPermissions()) return

    importFileAsText(".csv", handleImport)
}

async function exportCsv() {
    const filename = "redirects.csv"

    try {
        const redirects = await framer.getRedirects()

        if (redirects.length === 0) {
            framer.notify("This project has no redirects", { variant: "warning" })
            return
        }

        const csv = generateCsv(redirects)
        downloadBlob(csv, filename, "text/csv")

        framer.notify(`Successfully exported ${filename}`)
    } catch (error) {
        console.error(error)
        framer.notify(`Error exporting ${filename}`, { variant: "error" })
    }
}

export function App() {
    useEffect(() => {
        const handlePaste = async (event: ClipboardEvent) => {
            if (!event.clipboardData) return

            try {
                const csv = event.clipboardData.getData("text/plain")
                if (!csv) return

                if (!checkPermissions()) return

                await handleImport(csv)
            } catch (error) {
                console.error("Error accessing clipboard data:", error)
                framer.notify("Unable to access clipboard content", {
                    variant: "error",
                })
            }
        }

        window.addEventListener("paste", handlePaste)

        return () => {
            window.removeEventListener("paste", handlePaste)
        }
    }, [])

    return (
        <main>
            <hr />
            <div className="intro">
                <div className="asset">
                    <IconRedirects />
                </div>
                <div className="text">
                    <h4>Manage Redirects</h4>
                    <p>
                        Import and export redirects using CSV files.{" "}
                        <a href={learnMoreLink} target="_blank" rel="noreferrer">
                            Learn more
                        </a>
                    </p>
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
