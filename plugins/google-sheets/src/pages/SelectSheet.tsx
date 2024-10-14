import { useState } from "react"
import { framer } from "framer-plugin"
import { useSpreadsheetInfoQuery } from "../sheets"
import { Hero } from "../components/Hero"

type InputChangeEvent = React.ChangeEvent<HTMLInputElement>
type SelectChangeEvent = React.ChangeEvent<HTMLSelectElement>

interface Props {
    onSheetSelected: (spreadsheetId: string, sheetId: string) => void
}

export function SelectSheetPage({ onSheetSelected }: Props) {
    const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState("")
    const [selectedSheetId, setSelectedSheetId] = useState("")

    const { data: spreadsheetInfo, isFetching: isFetchingSheets } = useSpreadsheetInfoQuery(selectedSpreadsheetId)

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

    const handleSheetURLChange = (e: InputChangeEvent) => {
        try {
            const url = new URL(e.target.value)
            const id = url.pathname.replace("/spreadsheets/d/", "").replace("/edit", "")

            setSelectedSpreadsheetId(id)
        } catch (err) {
            // TODO(anthony): Show an error.
        }
    }

    return (
        <div className="col-lg">
            <Hero />
            <div className="col pl-[15px]">
                <div className="row justify-between align-middle">
                    <p>Spreadsheet</p>
                    <input placeholder="URL" onChange={handleSheetURLChange} />
                </div>
                <div className="row justify-between">
                    <p>Sheet</p>

                    <select
                        onChange={handleSheetSelect}
                        value={selectedSheetId || ""}
                        disabled={!spreadsheetInfo?.sheets.length}
                        className="px[16px] py-0"
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

            <button onClick={handleSheetSelected}>Next</button>
        </div>
    )
}
