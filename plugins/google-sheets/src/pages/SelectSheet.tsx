import { framer } from "framer-plugin"
import { useEffect, useState } from "react"
import { Hero } from "../components/Hero"
import { useSpreadsheetInfoQuery } from "../sheets"

type InputChangeEvent = React.ChangeEvent<HTMLInputElement>
type SelectChangeEvent = React.ChangeEvent<HTMLSelectElement>

interface Props {
    onError: () => void
    onSheetSelected: (spreadsheetId: string, sheetId: string) => void
}

export function SelectSheetPage({ onError, onSheetSelected }: Props) {
    const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<string>()
    const [selectedSheetTitle, setSelectedSheetTitle] = useState<string>()

    const {
        data: spreadsheetInfo,
        isFetching: isFetchingSheets,
        isError: isSpreadSheetInfoError,
    } = useSpreadsheetInfoQuery(selectedSpreadsheetId ?? "")

    useEffect(() => {
        if (isSpreadSheetInfoError) {
            onError()
        }
    }, [isSpreadSheetInfoError, onError])

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

    const handleSheetSelected = () => {
        if (selectedSpreadsheetId === undefined || selectedSheetTitle === undefined) {
            framer.notify("Please select a spreadsheet and sheet", { variant: "error" })
            return
        }

        onSheetSelected(selectedSpreadsheetId, selectedSheetTitle)
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
                        value={selectedSheetTitle ?? ""}
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
