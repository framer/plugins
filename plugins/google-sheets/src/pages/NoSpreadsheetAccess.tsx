import { PluginContextNoSheetAccess } from "../sheets"

interface Props {
    context: PluginContextNoSheetAccess
}

export function NoSpreadsheetAccess({ context }: Props) {
    const handleViewClick = () => {
        window.open(context.sheetUrl, "_blank")
    }
    return (
        <div>
            No spreadsheet access
            <button onClick={handleViewClick}>View Spreadsheet</button>
        </div>
    )
}
