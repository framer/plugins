import { framer } from "framer-plugin"
import { useEffect, useState } from "react"
import { type DataSource, getDataSources } from "./data"

interface SelectDataSourceProps {
    onSelectDataSource: (dataSource: DataSource) => void
}

enum Status {
    Loading = "loading",
    Ready = "ready",
    Error = "error",
}

export function SelectDataSource({ onSelectDataSource }: SelectDataSourceProps) {
    const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | null>(null)
    const [status, setStatus] = useState<Status>(Status.Loading)
    const [dataSources, setDataSources] = useState<DataSource[]>([])

    useEffect(() => {
        const fetchDataSources = async () => {
            try {
                const dataSources = await getDataSources()
                setDataSources(dataSources)
                setStatus(Status.Ready)
                if (dataSources.length > 0) {
                    setSelectedDatabaseId(dataSources[0]?.id ?? null)
                }
            } catch (error) {
                console.error(error)
                setStatus(Status.Error)
            }
        }

        void fetchDataSources()
    }, [])

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
            framer.notify(`Failed to load database “${selectedDatabaseId}”. Check the logs for more details.`, {
                variant: "error",
            })
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
                <label htmlFor="collection">
                    <select
                        id="collection"
                        onChange={event => {
                            setSelectedDatabaseId(event.target.value)
                        }}
                        value={selectedDatabaseId ?? ""}
                        disabled={status === Status.Loading}
                    >
                        <option value="" disabled>
                            {status === Status.Loading ? "Loading..." : "Choose Database"}
                        </option>
                        {dataSources.map(({ id, name }) => (
                            <option key={id} value={id}>
                                {name}
                            </option>
                        ))}
                    </select>
                </label>
                <button disabled={!selectedDatabaseId || status === Status.Loading}>
                    {status === Status.Loading ? <div className="framer-spinner" /> : "Next"}
                </button>
            </form>
        </main>
    )
}
