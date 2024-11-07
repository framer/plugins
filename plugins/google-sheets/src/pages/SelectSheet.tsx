import { useEffect, useState } from "react"
import { framer } from "framer-plugin"
import { useSpreadsheetInfoQuery } from "../sheets"
import { Hero } from "../components/Hero"

type InputChangeEvent = React.ChangeEvent<HTMLInputElement>
type SelectChangeEvent = React.ChangeEvent<HTMLSelectElement>

interface Props {
    onError: () => void
    onSheetSelected: (spreadsheetId: string, sheetId: number, sheetTitle: string) => void
}

export function SelectSheetPage({ onError, onSheetSelected }: Props) {
    const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState("")
    const [selectedSheetId, setSelectedSheetId] = useState<number | null>(null)
    const [selectedSheetTitle, setSelectedSheetTitle] = useState("")

    const { data: spreadsheetInfo, isFetching: isFetchingSheets, isError: isSpreadSheetInfoError } = useSpreadsheetInfoQuery(selectedSpreadsheetId)

    useEffect(() => {
        if (isSpreadSheetInfoError) {
            onError()
        }
    }, [isSpreadSheetInfoError, onError])

    const handleSheetSelect = (event: SelectChangeEvent) => {
        const id = parseInt(event.currentTarget.value)
        const sheet = spreadsheetInfo?.sheets.find((sheet) => id === sheet.properties.sheetId)
        if (!sheet) return console.warn("Sheet does not exist in spreadsheet")

        setSelectedSheetId(id)
        setSelectedSheetTitle(sheet.properties.title)
    }

    const handleSheetSelected = () => {
        if (!selectedSpreadsheetId || selectedSheetId === null) {
            framer.notify("Please select a spreadsheet and sheet", { variant: "error" })
            return
        }

        onSheetSelected(selectedSpreadsheetId, selectedSheetId, selectedSheetTitle)
    }

    const handleSheetURLChange = (e: InputChangeEvent) => {
        try {
            const url = new URL(e.target.value)
            if (url.hostname !== "docs.google.com") throw new Error("Not a Google Sheets URL")

            const id = url.pathname.replace("/spreadsheets/d/", "").replace("/edit", "")

            setSelectedSpreadsheetId(id)
        } catch (err) {
            setSelectedSpreadsheetId("")
        }
    }

    return (
        <div className="col-lg">
            <Hero />
            <div className="col pl-[15px]">
                <div className="row justify-between items-center">
                    <p>Spreadsheet</p>
                    <input placeholder="Sheet URL…" onChange={handleSheetURLChange} />
                </div>
                <div className="row justify-between items-center">
                    <p>Sheet</p>

                    <select
                        onChange={handleSheetSelect}
                        value={selectedSheetId?.toString() || ""}
                        disabled={!spreadsheetInfo?.sheets.length}
                        className="px[16px] py-0"
                    >
                        <option value="__choose" selected={selectedSheetId === null}>
                            {isFetchingSheets ? "Loading..." : "Choose..."}
                        </option>

                        {spreadsheetInfo?.sheets.map(({ properties }, i) => (
                            <option value={properties.sheetId.toString()} key={i} selected={selectedSheetId === properties.sheetId}>
                                {properties.title}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <button onClick={handleSheetSelected}>Next</button>
        </div>
    )
}
