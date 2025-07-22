import { framer } from "framer-plugin"
import { useEffect, useState } from "react"
import { useLocation } from "wouter"
import { usePublishedTables } from "../../../api"
import hero from "../../../assets/Hero.png"
import { useLoggingToggle } from "../../../cms"
import { CenteredSpinner } from "../../../components/CenteredSpinner"

// 1000 is the max number of HubDB tables
const LIMIT = 1000

export default function HubDBPage() {
    useLoggingToggle()

    const [, navigate] = useLocation()
    const { data: tables, isLoading } = usePublishedTables(LIMIT)
    const [selectedTableId, setSelectedTableId] = useState("")

    useEffect(() => {
        if (tables?.[0]?.id) {
            setSelectedTableId(tables[0].id)
        }
    }, [tables])

    const handleNext = () => {
        if (!selectedTableId) {
            framer.notify("Please select a table", { variant: "error" })
            return
        }

        navigate(`/cms/hubdb/map?tableId=${selectedTableId}`)
    }

    if (isLoading) return <CenteredSpinner size="medium" />

    if (!tables) return null

    if (tables.length === 0) {
        return (
            <div className="col items-center justify-center w-[320px] h-[320px] py-[15px]">
                <p className="text-primary">No Tables</p>
                <span className="text-tertiary text-center max-w-[200px]">
                    Create a table in HubDB to sync it with Framer
                </span>
            </div>
        )
    }

    return (
        <div className="col-lg px-[15px] pb-[15px]">
            <div className="min-h-[200px] flex items-center justify-center bg-[#FF6B36] bg-opacity-[0.08] rounded-[10px]">
                <img src={hero} alt="Floating sheet" className="object-contain w-[160px] h-[160px]" />
            </div>
            <div className="row justify-between items-center">
                <p>Table</p>
                <select
                    name="table"
                    id="table"
                    value={selectedTableId}
                    onChange={e => {
                        setSelectedTableId(e.target.value)
                    }}
                    className="w-[144px]"
                >
                    <option value="" disabled>
                        Choose...
                    </option>
                    {tables.map(table => (
                        <option key={table.id} value={table.id}>
                            {table.label}
                        </option>
                    ))}
                </select>
            </div>
            <button onClick={handleNext}>Next</button>
        </div>
    )
}
