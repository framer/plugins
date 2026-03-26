import { framer } from "framer-plugin"
import { useCallback, useEffect, useRef, useState } from "react"
import { type DataSource, getDataSource, getDataSourceOptions, getDataSources } from "./data"

interface SelectDataSourceProps {
    onSelectDataSource: (dataSource: DataSource) => void
    onDataSourceSelectVisibilityChange: (visible: boolean) => void
}

enum Status {
    Loading = "loading",
    Ready = "ready",
    Error = "error",
    Refreshing = "refreshing",
}

export function SelectDataSource({ onSelectDataSource, onDataSourceSelectVisibilityChange }: SelectDataSourceProps) {
    const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | null>(null)
    const [selectedDataSourceId, setSelectedDataSourceId] = useState<string | null>(null)
    const [status, setStatus] = useState<Status>(Status.Loading)
    const [dataSources, setDataSources] = useState<DataSource[]>([])
    const [databaseDataSources, setDatabaseDataSources] = useState<{ id: string; name: string }[] | null>(null)
    const isFirstFocusRef = useRef(true)

    const showDataSourceSelect = (databaseDataSources?.length ?? 0) > 1

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

    useEffect(() => {
        if (!selectedDatabaseId) {
            setDatabaseDataSources(null)
            setSelectedDataSourceId(null)
            return
        }

        let cancelled = false
        setDatabaseDataSources(null)
        setSelectedDataSourceId(null)

        const task = async () => {
            try {
                const fetchDataSourceOptions = getDataSourceOptions as (
                    databaseId: string
                ) => Promise<{ id: string; name: string }[]>
                const options = await fetchDataSourceOptions(selectedDatabaseId)
                if (cancelled) return
                setDatabaseDataSources(options)
                if (options.length > 1) {
                    setSelectedDataSourceId(options[0]?.id ?? null)
                }
            } catch (error) {
                if (cancelled) return
                console.error(error)
                setDatabaseDataSources([])
            }
        }

        void task()
        return () => {
            cancelled = true
        }
    }, [selectedDatabaseId])

    useEffect(() => {
        onDataSourceSelectVisibilityChange(showDataSourceSelect)
    }, [onDataSourceSelectVisibilityChange, showDataSourceSelect])

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!selectedDatabaseId) return
        if (showDataSourceSelect && !selectedDataSourceId) return

        try {
            setStatus(Status.Loading)

            const listItem = dataSources.find(ds => ds.id === selectedDatabaseId)
            if (!listItem) {
                framer.notify("Database not found", { variant: "error" })
                return
            }

            await framer.setCloseWarning("Synchronization setup in progress. Closing will cancel the sync.")

            // Fetch full DataSource with databaseUrl for "View in Notion" link
            const dataSource = await getDataSource(selectedDatabaseId, selectedDataSourceId)
            onSelectDataSource(dataSource)
        } catch (error) {
            await framer.setCloseWarning(false)

            console.error(error)
            const listItem = dataSources.find(ds => ds.id === selectedDatabaseId)
            framer.notify(
                `Failed to load database “${listItem?.name ?? selectedDatabaseId}”: ${error instanceof Error ? error.message : "Unknown error"}`,
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

            <form onSubmit={e => void handleSubmit(e)}>
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

                {showDataSourceSelect && (
                    <label htmlFor="data-source" className="collection-label">
                        <select
                            id="data-source"
                            onChange={event => {
                                setSelectedDataSourceId(event.target.value)
                            }}
                            value={selectedDataSourceId ?? ""}
                            disabled={status === Status.Loading}
                        >
                            <option value="" disabled>
                                Choose Data Source…
                            </option>
                            {databaseDataSources?.map(({ id, name }) => (
                                <option key={id} value={id}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    </label>
                )}

                <button
                    disabled={
                        !selectedDatabaseId ||
                        status === Status.Loading ||
                        (showDataSourceSelect && !selectedDataSourceId)
                    }
                >
                    {status === Status.Loading ? <div className="framer-spinner" /> : "Next"}
                </button>
            </form>
        </main>
    )
}
