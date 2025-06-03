import { framer } from "framer-plugin"
import { useEffect, useRef, useState } from "react"
import { type DataSource, getDataSource, dataSourceOptions, PLUGIN_KEYS } from "../data"

interface SelectDataSourceProps {
    onSelectDataSource: (dataSource: DataSource) => void
    previousDataSourceId?: string | null
    previousBoardToken?: string | null
    onSelectBoardToken?: (boardToken: string) => void
}

export function SelectDataSource({
    onSelectDataSource,
    previousDataSourceId,
    previousBoardToken,
    onSelectBoardToken,
}: SelectDataSourceProps) {
    const [selectedDataSourceId, setSelectedDataSourceId] = useState<string>(
        previousDataSourceId ?? dataSourceOptions[0].id
    )
    const [isLoading, setIsLoading] = useState(false)

    // const [defaultBoardToken, setDefaultBoardToken] = useState<string | null>(previousBoardToken)

    // useEffect(() => {
    //     async function getBoardToken() {
    //         const defaultBoardToken = await framer.getPluginData(PLUGIN_KEYS.SPACE_ID)
    //         if (defaultBoardToken) {
    //             setDefaultBoardToken(defaultBoardToken)
    //         }
    //     }
    //     getBoardToken()
    // }, [])

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const boardToken = (event.target as HTMLFormElement).boardToken.value
        const collection = (event.target as HTMLFormElement).collection.value

        if (!boardToken || !collection) return

        try {
            setIsLoading(true)

            const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${boardToken}`)
            if (response.status === 200) {
                onSelectBoardToken?.(boardToken)
                console.log("success")
            } else {
                throw new Error(`Board ${boardToken} not found`)
            }

            const dataSource = await getDataSource(selectedDataSourceId)
            onSelectDataSource(dataSource)
        } catch (error) {
            console.error(error)
            framer.notify(error instanceof Error ? error.message : "An unknown error occurred", {
                variant: "error",
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <main className="framer-hide-scrollbar setup">
            <img src="/Asset.png" alt="Greenhouse Hero" onDragStart={e => e.preventDefault()} />

            <form onSubmit={handleSubmit}>
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
