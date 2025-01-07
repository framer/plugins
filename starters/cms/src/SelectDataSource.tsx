import type { DataSource } from "./data"

import { framer } from "framer-plugin"
import { useState } from "react"
import { getDataSource, getDataSources } from "./data"

function DatabaseIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150">
            <path
                fill="#999"
                d="M75 33c18.778 0 34 7.611 34 17S93.778 67 75 67s-34-7.611-34-17 15.222-17 34-17Zm34 40.333C109 82.538 93.778 90 75 90s-34-7.462-34-16.667V60c0 9.389 15.222 17 34 17 18.776 0 33.997-7.61 34-16.997v13.33ZM109 84v.497c0-.166-.005-.332-.015-.497Zm0 13.333C109 106.538 93.778 114 75 114s-34-7.462-34-16.667V84h.015c-.01.166-.015.333-.015.5 0 9.113 15.222 16.5 34 16.5 18.776 0 33.997-7.386 34-16.497v12.83Z"
            />
        </svg>
    )
}

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
            <div className="logo">
                <DatabaseIcon />
            </div>

            <form onSubmit={handleSubmit}>
                <label htmlFor="collection">
                    Collection
                    <select
                        id="collection"
                        onChange={event => setSelectedDataSourceId(event.target.value)}
                        value={selectedDataSourceId}
                    >
                        <option value="" disabled>
                            Choose…
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
