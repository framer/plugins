import type { DataSource } from "./data"

import { framer } from "framer-plugin"
import { useState } from "react"
import { getDataSource, getDataSources } from "./data"

interface SelectDataSourceProps {
    onSelectDataSource: (dataSource: DataSource) => void
}

export function SelectDataSource({ onSelectDataSource }: SelectDataSourceProps) {
    const [dataSources] = useState(() => getDataSources())
    const [selectedDataSourceId, setSelectedDataSourceId] = useState<string>(dataSources[0]?.id ?? "")
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        try {
            setIsLoading(true)

            const dataSource = await getDataSource(selectedDataSourceId)
            onSelectDataSource(dataSource)
        } catch (error) {
            console.error(error)
            framer.notify(`Failed to load data source “${selectedDataSourceId}”. Check the logs for more details.`, {
                variant: "error",
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <main className="framer-hide-scrollbar setup">
            <div className="intro">
                <div className="logo">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="15" fill="none">
                        <path
                            fill="currentColor"
                            d="M6.5 0C10.09 0 13 1.38 13 3.083c0 1.702-2.91 3.082-6.5 3.082S0 4.785 0 3.083C0 1.38 2.91 0 6.5 0ZM13 7.398c0 1.703-2.91 3.083-6.5 3.083S0 9.101 0 7.398V4.932c0 1.703 2.91 3.083 6.5 3.083S13 6.635 13 4.932v2.466Zm0 4.316c0 1.703-2.91 3.083-6.5 3.083S0 13.417 0 11.714V9.248c0 1.702 2.91 3.083 6.5 3.083S13 10.95 13 9.248v2.466Z"
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
                        {dataSources.map(({ id, name }) => (
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
