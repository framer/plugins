import cx from "classnames"
import { framer } from "framer-plugin"
import { useEffect, useMemo, useState } from "react"
import { Hero } from "../components/Hero"
import { useSpreadsheetInfoQuery } from "../sheets"

type InputChangeEvent = React.ChangeEvent<HTMLInputElement>
type SelectChangeEvent = React.ChangeEvent<HTMLSelectElement>

interface Props {
    onError: () => void
    onSheetSelected: (spreadsheetId: string, sheetId: string) => void
}

export function SelectSheetPage({ onError, onSheetSelected }: Props) {
    const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>("")
    const [selectedSheetTitle, setSelectedSheetTitle] = useState<string>("")

    const selectedSpreadsheetId = useMemo(() => {
        if (!spreadsheetUrl) return null

        try {
            const url = new URL(spreadsheetUrl)
            if (url.hostname !== "docs.google.com") throw new Error("Not a Google Sheets URL")

            const id = url.pathname.replace("/spreadsheets/d/", "").replace("/edit", "")

            return id
        } catch (err) {
            return null
        }
    }, [spreadsheetUrl])

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

    const handleSpreadsheetUrlChange = (e: InputChangeEvent) => {
        setSpreadsheetUrl(e.target.value)
    }

    const handleSheetChange = (e: SelectChangeEvent) => {
        setSelectedSheetTitle(e.target.value)
    }

    const handleNextClick = () => {
        if (!selectedSpreadsheetId || !selectedSheetTitle) {
            framer.notify("Please select a spreadsheet and sheet", { variant: "error" })
            return
        }

        onSheetSelected(selectedSpreadsheetId, selectedSheetTitle)
    }

    return (
        <main className="col-lg select-none">
            <Hero />
            <div className="col pl-[15px]">
                <div className="row justify-between items-center">
                    <p>Spreadsheet</p>
                    <input
                        autoFocus
                        placeholder="Sheet URL…"
                        value={spreadsheetUrl}
                        onChange={handleSpreadsheetUrlChange}
                    />
                </div>
                <div className="row justify-between items-center">
                    <p>Sheet</p>

                    <select
                        onChange={handleSheetChange}
                        value={selectedSheetTitle}
                        disabled={!spreadsheetInfo?.sheets.length}
                        className={cx(!spreadsheetInfo?.sheets.length && "opacity-50")}
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
                disabled={isFetchingSheets || !selectedSpreadsheetId || !selectedSheetTitle}
                onClick={handleNextClick}
            >
                Next
            </button>
        </main>
    )
}
