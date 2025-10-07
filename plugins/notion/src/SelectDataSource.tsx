import { framer } from "framer-plugin"
import { useCallback, useEffect, useRef, useState } from "react"
import { type DataSource, getDataSources } from "./data"

interface SelectDataSourceProps {
    onSelectDataSource: (dataSource: DataSource) => void
}

enum Status {
    Loading = "loading",
    Ready = "ready",
    Error = "error",
    Refreshing = "refreshing",
}

export function SelectDataSource({ onSelectDataSource }: SelectDataSourceProps) {
    const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | null>(null)
    const [status, setStatus] = useState<Status>(Status.Loading)
    const [dataSources, setDataSources] = useState<DataSource[]>([])
    const isFirstFocusRef = useRef(true)

    const fetchDataSources = useCallback(async (status: Status) => {
        try {
            setStatus(status)
            const dataSources = await getDataSources()
            setDataSources(dataSources)
            setStatus(Status.Ready)

            setSelectedDatabaseId(prev => {
                // Clear selection if no databases are available
                if (dataSources.length === 0) return null

                // Auto-select if no database is currently selected or if the current selection is no longer valid
                const currentSelectionIsValid = prev && dataSources.some(ds => ds.id === prev)
                if (dataSources.length > 0 && !currentSelectionIsValid) {
                    return dataSources[0]?.id ?? null
                }

                return prev
            })
        } catch (error) {
            console.error(error)
            setStatus(Status.Error)
        }
    }, [])

    useEffect(() => {
        const handleWindowFocus = () => {
            if (isFirstFocusRef.current) {
                isFirstFocusRef.current = false
                return
            }
            void fetchDataSources(Status.Refreshing)
        }

        window.addEventListener("focus", handleWindowFocus)
        void fetchDataSources(Status.Loading)

        return () => {
            window.removeEventListener("focus", handleWindowFocus)
        }
    }, [fetchDataSources])

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!selectedDatabaseId) return

        try {
            setStatus(Status.Loading)

            const dataSource = dataSources.find(dataSource => dataSource.id === selectedDatabaseId)
            if (!dataSource) {
                framer.notify("Database not found", { variant: "error" })
                return
            }

            onSelectDataSource(dataSource)
        } catch (error) {
            console.error(error)
            const dataSource = dataSources.find(dataSource => dataSource.id === selectedDatabaseId)
            framer.notify(
                `Failed to load database “${dataSource?.name ?? selectedDatabaseId}”: ${error instanceof Error ? error.message : "Unknown error"}`,
                { variant: "error" }
            )
        } finally {
            setStatus(Status.Ready)
        }
    }

    return (
        <main className="framer-hide-scrollbar setup">
            <div className="intro">
                <img src="/notion-connect.png" className="select-database-img" />
                <p>
                    To manually connect a database, open it in Notion, click on the three dots icon in the top right
                    corner, then select Connections and connect to Framer.
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                <label htmlFor="collection" className="collection-label">
                    <select
                        id="collection"
                        onChange={event => {
                            setSelectedDatabaseId(event.target.value)
                        }}
                        value={selectedDatabaseId ?? ""}
                        disabled={status === Status.Loading}
                    >
                        <option value="" disabled>
                            {status === Status.Loading ? "Loading…" : "Choose Database…"}
                        </option>
                        {dataSources.map(({ id, name }) => (
                            <option key={id} value={id}>
                                {name}
                            </option>
                        ))}
                    </select>
                    {status === Status.Refreshing && <div className="framer-spinner" />}
                </label>
                <button disabled={!selectedDatabaseId || status === Status.Loading}>
                    {status === Status.Loading ? <div className="framer-spinner" /> : "Next"}
                </button>
            </form>
        </main>
    )
}
