import { framer } from "framer-plugin"
import { useState } from "react"
import { type DataSource, getDataSource, dataSourceOptions } from "../data"

interface SelectDataSourceProps {
    onSelectDataSource: (dataSource: DataSource) => void
    previousDataSourceId?: string | null
}

export function SelectDataSource({ onSelectDataSource, previousDataSourceId }: SelectDataSourceProps) {
    const [selectedDataSourceId, setSelectedDataSourceId] = useState<string>(
        previousDataSourceId ?? dataSourceOptions[0].id
    )
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
        <div className="framer-hide-scrollbar setup">
            <img src="/Asset.png" alt="Greenhouse Hero" onDragStart={e => e.preventDefault()} />

            <form onSubmit={handleSubmit}>
                <label>
                    <p>Collection</p>
                    <select
                        id="collection"
                        onChange={event => setSelectedDataSourceId(event.target.value)}
                        value={selectedDataSourceId}
                    >
                        <option value="" disabled>
                            Choose Source…
                        </option>
                        {dataSourceOptions.map(({ id, name }) => (
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
        </div>
    )
}
