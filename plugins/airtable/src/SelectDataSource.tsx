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
    const [status, setStatus] = useState<"loading-bases" | "loading-tables" | "ready" | "error-bases" | "error-tables">(
        "loading-bases"
    )
    const [bases, setBases] = useState<AirtableBase[]>([])
    const [tables, setTables] = useState<AirtableTable[]>([])

    const [selectedBaseId, setSelectedBaseId] = useState<string>("")
    const [selectedTableId, setSelectedTableId] = useState<string>("")
    const [isLoading, setIsLoading] = useState(false)

    const selectedBase = bases.find(base => base.id === selectedBaseId)

    useEffect(() => {
        setStatus("loading-bases")

        const task = async () => {
            try {
                const bases = await getUserBases()
                setBases(bases)
                setSelectedBaseId(bases[0]?.id ?? "")
            } catch (error) {
                console.error(error)
                setStatus("error-bases")
                framer.notify("Failed to load bases. Check the logs for more details.", { variant: "error" })
            }
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
                try {
                    const tables = await getTables(selectedBaseId, abortController.signal)
                    if (abortController.signal.aborted) return

                    setTables(tables)
                    setStatus("ready")
                    setSelectedTableId(tables[0]?.id ?? "")
                } catch (error) {
                    console.error(error)
                    setStatus("error-tables")

                    const baseName = selectedBase?.name ?? selectedBaseId
                    framer.notify(`Failed to load tables for base "${baseName}". Check the logs for more details.`, {
                        variant: "error",
                    })
                }
            }

            void task()
        }

        return () => {
            abortController.abort()
        }
    }, [selectedBaseId, selectedBase])

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

            <div className="setup-list">
                <label htmlFor="base">
                    Base
                    <select
                        id="base"
                        onChange={event => {
                            setSelectedBaseId(event.target.value)
                        }}
                        value={selectedBaseId}
                        disabled={status === "loading-bases" || status === "error-bases"}
                    >
                        <option value="" disabled>
                            {status === "loading-bases" ? "Loading…" : status === "error-bases" ? "Error" : "Choose…"}
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
                        disabled={
                            !selectedBaseId ||
                            status === "loading-tables" ||
                            status === "error-tables" ||
                            status === "error-bases"
                        }
                    >
                        <option value="" disabled>
                            {status === "loading-tables"
                                ? "Loading…"
                                : status === "error-tables" || status === "error-bases"
                                  ? "Error"
                                  : "Choose…"}
                        </option>
                        {tables.map(({ id, name }) => (
                            <option key={id} value={id}>
                                {name}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <button type="submit" disabled={!selectedBaseId || !selectedTableId || isLoading}>
                {isLoading ? <div className="framer-spinner" /> : "Next"}
            </button>
        </form>
    )
}
