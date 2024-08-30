import { useState } from "react"
import { framer } from "framer-plugin"
import { useSpreadsheetInfoQuery, useSpreadsheetsQuery } from "../sheets"
import { Hero } from "../components/Hero"

type SelectChangeEvent = React.ChangeEvent<HTMLSelectElement>

interface Props {
    onSheetSelected: (spreadsheetId: string, sheetId: string) => void
}

export function SelectSheetPage({ onSheetSelected }: Props) {
    const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState("")
    const [selectedSheetId, setSelectedSheetId] = useState("")

    const { data: spreadsheets, isFetching: isFetchingSpreadsheets } = useSpreadsheetsQuery()
    const { data: spreadsheetInfo, isFetching: isFetchingSheets } = useSpreadsheetInfoQuery(selectedSpreadsheetId)

    const handleSpreadsheetSelect = (e: SelectChangeEvent) => {
        setSelectedSpreadsheetId(e.target.value)
        setSelectedSheetId("")
    }

    const handleSheetSelect = (e: SelectChangeEvent) => {
        setSelectedSheetId(e.target.value)
    }

    const handleSheetSelected = () => {
        if (!selectedSpreadsheetId || !selectedSheetId) {
            framer.notify("Please select a spreadsheet and sheet", { variant: "error" })
            return
        }

        onSheetSelected(selectedSpreadsheetId, selectedSheetId)
    }

    return (
        <div className="col-lg">
            <Hero />
            <div className="col pl-[15px]">
                <div className="row justify-between">
                    <p>Spreadsheet</p>
                    <select onChange={handleSpreadsheetSelect} value={selectedSpreadsheetId || ""}>
                        <option value="" disabled>
                            {isFetchingSpreadsheets ? "Loading..." : "Choose..."}
                        </option>
                        {spreadsheets?.files.map((spreadsheet, i) => (
                            <option value={spreadsheet.id} key={i}>
                                {spreadsheet.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="row justify-between">
                    <p>Sheet</p>
                    <select onChange={handleSheetSelect} value={selectedSheetId || ""}>
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
            <button onClick={handleSheetSelected}>Next</button>
        </div>
    )
}
