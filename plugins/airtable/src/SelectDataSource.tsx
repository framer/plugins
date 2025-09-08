import { framer, type ManagedCollection } from "framer-plugin"
import { useEffect, useMemo, useRef, useState } from "react"
import auth from "./auth"
import type { AirtableBase, AirtableTable, DataSource } from "./data"
import { getTables, getUserBases } from "./data"
import { inferFields } from "./fields"

const STATUS_MAP = {
    "loading-bases": { bases: "Loading…", tables: "Choose…" },
    "error-bases": { bases: "Error", tables: "Error" },
    "loading-tables": { bases: "Choose…", tables: "Loading…" },
    "error-tables": { bases: "Choose…", tables: "Error" },
    ready: { bases: "Choose…", tables: "Choose…" },
}

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

    const basesLoadedRef = useRef(false)
    const lastBaseIdRef = useRef<string>("")

    const selectedBase = bases.find(base => base.id === selectedBaseId)
    const { bases: basesPlaceholderText, tables: tablesPlaceholderText } = STATUS_MAP[status]

    const loadBases = async () => {
        setStatus("loading-bases")

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

    useEffect(() => {
        if (basesLoadedRef.current) return
        basesLoadedRef.current = true
        void loadBases()
    }, [])

    useEffect(() => {
        const abortController = new AbortController()

        if (selectedBaseId && selectedBaseId !== lastBaseIdRef.current) {
            lastBaseIdRef.current = selectedBaseId
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

    const handleRetryClick = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        void loadBases()
    }

    const handleLogout = () => {
        void auth.logout()
    }

    if (status === "error-bases") {
        return (
            <form className="setup-error" onSubmit={handleRetryClick}>
                <span>Failed to load bases</span>
                <div className="actions">
                    <button className="action-button" onClick={handleLogout}>
                        Log Out
                    </button>
                    <button type="submit" className="action-button framer-button-primary">
                        Retry
                    </button>
                </div>
            </form>
        )
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
                        disabled={status === "loading-bases"}
                    >
                        <option value="" disabled>
                            {basesPlaceholderText}
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
                        disabled={!selectedBaseId || status === "loading-tables" || status === "error-tables"}
                    >
                        <option value="" disabled>
                            {tablesPlaceholderText}
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
