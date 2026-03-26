import { framer } from "framer-plugin"
import { useCallback, useEffect, useRef, useState } from "react"
import { type DataSource, getDataSource, getDataSources, getViewOptions } from "./data"

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
    const [selectedViewId, setSelectedViewId] = useState<string | null>(null)
    const [status, setStatus] = useState<Status>(Status.Loading)
    const [dataSources, setDataSources] = useState<DataSource[]>([])
    const [databaseViews, setDatabaseViews] = useState<{ id: string; name: string }[] | null>(null)
    const isFirstFocusRef = useRef(true)

    const hasViews = (databaseViews?.length ?? 0) > 0

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
            setDatabaseViews(null)
            setSelectedViewId(null)
            return
        }

        let cancelled = false
        setDatabaseViews(null)
        setSelectedViewId(null)

        const task = async () => {
            try {
                const options = await getViewOptions(selectedDatabaseId)
                if (cancelled) return
                setDatabaseViews(options)
                if (options.length > 0) {
                    setSelectedViewId(options[0]?.id ?? null)
                }
            } catch (error) {
                if (cancelled) return
                console.error(error)
                setDatabaseViews([])
            }
        }

        void task()
        return () => {
            cancelled = true
        }
    }, [selectedDatabaseId])

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!selectedDatabaseId) return
        if (hasViews && !selectedViewId) return

        try {
            setStatus(Status.Loading)

            const listItem = dataSources.find(ds => ds.id === selectedDatabaseId)
            if (!listItem) {
                framer.notify("Database not found", { variant: "error" })
                return
            }

            await framer.setCloseWarning("Synchronization setup in progress. Closing will cancel the sync.")

            // Fetch full data source schema using selected view as the source of truth.
            const dataSource = await getDataSource(selectedDatabaseId, selectedViewId)
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
                <div className="select-database-img-container">
                    <img src="/notion-connect.png" />
                </div>
                <p>
                    To manually connect a database, open it in Notion, click on the three dots icon in the top right
                    corner, then select Connections and connect to Framer.
                </p>
            </div>

            <form onSubmit={e => void handleSubmit(e)}>
                <div className="property-controls-list">
                    <div className="property-control">
                        <p>Database</p>
                        <select
                            id="collection"
                            onChange={event => {
                                setSelectedDatabaseId(event.target.value)
                            }}
                            value={selectedDatabaseId ?? ""}
                            disabled={status === Status.Loading}
                            className={status === Status.Refreshing ? "refreshing" : ""}
                        >
                            {status === Status.Loading && (
                                <option value="" disabled>
                                    Loading…
                                </option>
                            )}
                            {dataSources.map(({ id, name }) => (
                                <option key={id} value={id}>
                                    {name}
                                </option>
                            ))}
                        </select>
                        {status === Status.Refreshing && <div className="framer-spinner" />}
                    </div>

                    <div className="property-control">
                        <p>View</p>
                        <select
                            id="view"
                            onChange={event => {
                                setSelectedViewId(event.target.value)
                            }}
                            value={selectedViewId ?? ""}
                            disabled={!hasViews || status === Status.Loading}
                        >
                            {status === Status.Loading && (
                                <option value="" disabled>
                                    Loading…
                                </option>
                            )}
                            {databaseViews?.map(({ id, name }) => (
                                <option key={id} value={id}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <button disabled={!selectedDatabaseId || status === Status.Loading}>
                    {status === Status.Loading ? <div className="framer-spinner" /> : "Next"}
                </button>
            </form>
        </main>
    )
}
