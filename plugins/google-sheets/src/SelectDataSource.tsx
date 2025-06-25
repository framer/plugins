import { framer } from "framer-plugin"
import { useState, useEffect } from "react"
import { type DataSource } from "./data"
import { Hero } from "./components/Hero"
import { useSpreadsheetInfoQuery } from "./sheets"

type InputChangeEvent = React.ChangeEvent<HTMLInputElement>
type SelectChangeEvent = React.ChangeEvent<HTMLSelectElement>

interface SelectDataSourceProps {
    onSelectDataSource: (dataSource: DataSource) => void
}

export function SelectDataSource({ onSelectDataSource }: SelectDataSourceProps) {
    const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<string>()
    const [selectedSheetTitle, setSelectedSheetTitle] = useState<string>()
    const [isLoading, setIsLoading] = useState(false)

    const {
        data: spreadsheetInfo,
        isFetching: isFetchingSheets,
        isError: isSpreadSheetInfoError,
    } = useSpreadsheetInfoQuery(selectedSpreadsheetId ?? "")

    // useEffect(() => {
    //     if (isSpreadSheetInfoError) {
    //         onError()
    //     }
    // }, [isSpreadSheetInfoError, onError])

    useEffect(() => {
        const firstSheet = spreadsheetInfo?.sheets[0]
        if (!firstSheet) {
            return
        }

        setSelectedSheetTitle(firstSheet.properties.title)
    }, [spreadsheetInfo])

    const handleSheetSelect = (e: SelectChangeEvent) => {
        setSelectedSheetTitle(e.target.value)
    }

    const handleSheetURLChange = (e: InputChangeEvent) => {
        try {
            const url = new URL(e.target.value)
            if (url.hostname !== "docs.google.com") throw new Error("Not a Google Sheets URL")

            const id = url.pathname.replace("/spreadsheets/d/", "").replace("/edit", "")

            setSelectedSpreadsheetId(id)
        } catch (err) {
            setSelectedSpreadsheetId(undefined)
        }
    }

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault()
            const selectElement = document.querySelector("select") as HTMLSelectElement
            if (selectElement) {
                selectElement.focus()
            }
        }
    }

    const handleSelectKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>) => {
        if (e.key === "Enter") {
            e.preventDefault()
            handleSubmit()
        }
    }

    const handleSubmit = async () => {
        if (selectedSpreadsheetId === undefined || selectedSheetTitle === undefined) {
            framer.notify("Please select a spreadsheet and sheet", { variant: "error" })
            return
        }

        try {
            setIsLoading(true)

            const dataSource: DataSource = {
                id: selectedSpreadsheetId,
                sheetTitle: selectedSheetTitle,
            }

            onSelectDataSource(dataSource)
        } catch (error) {
            console.error(error)
            framer.notify(`Failed to load data source “${selectedSpreadsheetId}”. Check the logs for more details.`, {
                variant: "error",
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <main className="framer-hide-scrollbar setup">
            <Hero />

            <div className="setup-container">
                <div className="property-control">
                    <p>Spreadsheet</p>
                    <input
                        placeholder="Sheet URL…"
                        onChange={handleSheetURLChange}
                        onKeyDown={handleInputKeyDown}
                        autoFocus
                    />
                </div>
                <div className="property-control">
                    <p>Sheet</p>

                    <select
                        onChange={handleSheetSelect}
                        onKeyDown={handleSelectKeyDown}
                        value={selectedSheetTitle ?? ""}
                        disabled={!spreadsheetInfo?.sheets.length}
                        className=""
                    >
                        <option value="" disabled>
                            {isFetchingSheets ? "Loading..." : "Choose..."}
                        </option>

                        {spreadsheetInfo?.sheets.map(({ properties: { title } }, i) => (
                            <option value={title} key={i}>
                                {title}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <button
                type="submit"
                disabled={!selectedSpreadsheetId || !selectedSheetTitle || isLoading}
                onClick={handleSubmit}
                className="framer-button-primary"
            >
                {isLoading ? <div className="framer-spinner" /> : "Next"}
            </button>
        </main>
    )
}
