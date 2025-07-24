import { framer, type ManagedCollection } from "framer-plugin"
import { useEffect, useState } from "react"
import type { AirtableBase, AirtableTable, DataSource } from "./data"
import { getTables, getUserBases } from "./data"
import { inferFields } from "./fields"

interface SelectDataSourceProps {
    collection: ManagedCollection
    onSelectDataSource: (dataSource: DataSource) => void
}

export function SelectDataSource({ collection, onSelectDataSource }: SelectDataSourceProps) {
    const [status, setStatus] = useState<"loading-bases" | "loading-tables" | "ready" | "error">("loading-bases")
    const [bases, setBases] = useState<AirtableBase[]>([])
    const [tables, setTables] = useState<AirtableTable[]>([])

    const [selectedBaseId, setSelectedBaseId] = useState<string>("")
    const [selectedTableId, setSelectedTableId] = useState<string>("")
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        setStatus("loading-bases")

        const task = async () => {
            const bases = await getUserBases()
            setBases(bases)
            setSelectedBaseId(bases[0]?.id ?? "")
        }

        void task()
    }, [])

    useEffect(() => {
        const abortController = new AbortController()

        if (selectedBaseId) {
            setStatus("loading-tables")
            setTables([])
            setSelectedTableId("")

            const task = async () => {
                const tables = await getTables(selectedBaseId, abortController.signal)
                if (abortController.signal.aborted) return

                setTables(tables)
                setStatus("ready")
                setSelectedTableId(tables[0]?.id ?? "")
            }

            void task()
        }

        return () => {
            abortController.abort()
        }
    }, [selectedBaseId])

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!selectedBaseId || !selectedTableId) {
            framer.notify("Please select a base and table", { variant: "error" })
            return
        }

        const task = async () => {
            try {
                setIsLoading(true)

                const selectedTable = tables.find(table => table.id === selectedTableId)
                if (!selectedTable) {
                    framer.notify("Table not found", { variant: "error" })
                    return
                }
                const fields = await inferFields(collection, selectedTable)
                onSelectDataSource({
                    baseId: selectedBaseId,
                    tableId: selectedTableId,
                    tableName: selectedTable.name,
                    fields,
                })
            } catch (error) {
                console.error(error)
                framer.notify("Failed to load data source. Check the logs for more details.", { variant: "error" })
            } finally {
                setIsLoading(false)
            }
        }

        void task()
    }

    return (
        <form className="framer-hide-scrollbar setup" onSubmit={handleSubmit}>
            <div className="logo">
                <img src="airtable.svg" alt="Airtable icon" style={{ width: 80, height: 80 }} />
            </div>

            <label htmlFor="base">
                Base
                <select
                    id="base"
                    onChange={event => {
                        setSelectedBaseId(event.target.value)
                    }}
                    value={selectedBaseId}
                    disabled={status === "loading-bases"}
                >
                    <option value="" disabled>
                        {status === "loading-bases" ? "Loading…" : "Choose…"}
                    </option>
                    {bases.map(({ id, name }) => (
                        <option key={id} value={id}>
                            {name}
                        </option>
                    ))}
                </select>
            </label>

            <label htmlFor="table">
                Table
                <select
                    id="table"
                    onChange={event => {
                        setSelectedTableId(event.target.value)
                    }}
                    value={selectedTableId}
                    disabled={!selectedBaseId || status === "loading-tables"}
                >
                    <option value="" disabled>
                        {status === "loading-tables" ? "Loading…" : "Choose…"}
                    </option>
                    {tables.map(({ id, name }) => (
                        <option key={id} value={id}>
                            {name}
                        </option>
                    ))}
                </select>
            </label>

            <button type="submit" disabled={!selectedBaseId || !selectedTableId || isLoading}>
                {isLoading ? <div className="framer-spinner" /> : "Next"}
            </button>
        </form>
    )
}
