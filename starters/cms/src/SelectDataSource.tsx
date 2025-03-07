import { framer } from "framer-plugin"
import { useState } from "react"
import { type DataSource, type DataSourceHeader, getDataSource, useDataSourceHeaders } from "./data"

interface SelectDataSourceProps {
    onSelectDataSource: (dataSource: DataSource) => void
}

export function SelectDataSource({ onSelectDataSource }: SelectDataSourceProps) {
    const { dataSourceHeaders, araDataSourceHeadersLoading } = useDataSourceHeaders()
    const [previousDataSourceHeaders, setPreviousDataSourceHeaders] = useState<DataSourceHeader[]>(dataSourceHeaders)
    const [selectedDataSourceId, setSelectedDataSourceId] = useState<string>(dataSourceHeaders[0]?.id ?? "")
    const [isDataSourceLoading, setIsDataSourceLoading] = useState(false)

    if (dataSourceHeaders !== previousDataSourceHeaders) {
        setPreviousDataSourceHeaders(dataSourceHeaders)
        if (selectedDataSourceId !== "" && !dataSourceHeaders.some(source => selectedDataSourceId === source.id)) {
            setSelectedDataSourceId("")
        }
    }

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        try {
            setIsDataSourceLoading(true)
            const dataSource = await getDataSource(selectedDataSourceId)
            onSelectDataSource(dataSource)
        } catch (error) {
            console.error(error)
            framer.notify(`Failed to load data source “${selectedDataSourceId}”. Check the logs for more details.`, {
                variant: "error",
            })
        } finally {
            setIsDataSourceLoading(false)
        }
    }

    const isLoading = araDataSourceHeadersLoading || isDataSourceLoading

    return (
        <main className="framer-hide-scrollbar setup">
            <div className="intro">
                <div className="logo">
                    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="none">
                        <path
                            fill="currentColor"
                            d="M15.5 8c3.59 0 6.5 1.38 6.5 3.083 0 1.702-2.91 3.082-6.5 3.082S9 12.785 9 11.083C9 9.38 11.91 8 15.5 8Zm6.5 7.398c0 1.703-2.91 3.083-6.5 3.083S9 17.101 9 15.398v-2.466c0 1.703 2.91 3.083 6.5 3.083s6.5-1.38 6.5-3.083Zm0 4.316c0 1.703-2.91 3.083-6.5 3.083S9 21.417 9 19.714v-2.466c0 1.702 2.91 3.083 6.5 3.083S22 18.95 22 17.248Z"
                        />
                    </svg>
                </div>
                <div className="content">
                    <h2>CMS Starter</h2>
                    <p>Everything you need to get started with a CMS Plugin.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <label htmlFor="collection">
                    <select
                        id="collection"
                        onChange={event => setSelectedDataSourceId(event.target.value)}
                        value={selectedDataSourceId}
                    >
                        <option value="" disabled>
                            Choose Source…
                        </option>
                        {dataSourceHeaders.map(({ id, name }) => (
                            <option key={id} value={id}>
                                {name}
                            </option>
                        ))}
                    </select>
                </label>
                <button disabled={!selectedDataSourceId || isLoading}>
                    {isLoading ? <div className="framer-spinner" /> : "Next"}
                </button>
            </form>
        </main>
    )
}
