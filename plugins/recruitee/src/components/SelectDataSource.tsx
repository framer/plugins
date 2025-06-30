import { framer } from "framer-plugin"
import { useState } from "react"
import { type DataSource, getDataSource, dataSourceOptions } from "../data"
import Asset from "../../assets/Asset.png"

interface SelectDataSourceProps {
    onSelectDataSource: (dataSource: DataSource) => void
    previousDataSourceId?: string | null
    previousBoardToken?: string | null
    previousCompanyId?: string | null
    onSelectBoardToken?: (boardToken: string) => void
}

export function SelectDataSource({
    onSelectDataSource,
    previousDataSourceId,
    previousBoardToken,
    previousCompanyId,
}: SelectDataSourceProps) {
    const [selectedDataSourceId, setSelectedDataSourceId] = useState<string>(
        previousDataSourceId ?? dataSourceOptions[0].id
    )
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const boardToken = (event.target as HTMLFormElement).boardToken.value
        const companyId = (event.target as HTMLFormElement).companyId.value
        const collection = (event.target as HTMLFormElement).collection.value

        if (!boardToken || !collection) return

        try {
            setIsLoading(true)
            const dataSource = await getDataSource(companyId, boardToken, selectedDataSourceId)
            onSelectDataSource(dataSource)
        } catch (error) {
            framer.notify(error instanceof Error ? error.message : "An unknown error occurred", {
                variant: "error",
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <main className="framer-hide-scrollbar setup">
            <img src={Asset} alt="Recruitee" onDragStart={e => e.preventDefault()} />
            <form onSubmit={handleSubmit}>
                <label>
                    <p>Company Id</p>
                    <input
                        id="companyId"
                        type="text"
                        placeholder="Company Id"
                        required
                        defaultValue={previousCompanyId ?? ""}
                    />
                </label>
                <label>
                    <p>Board Token</p>
                    <input
                        id="boardToken"
                        type="text"
                        placeholder="Token"
                        required
                        defaultValue={previousBoardToken ?? ""}
                    />
                </label>
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
        </main>
    )
}
