import { framer, useIsAllowedTo } from "framer-plugin"
import { useCallback, useState } from "react"
import hero from "../assets/hero.png"
import { getDataSource, syncMethods } from "../data"
import { dataSources, type GreenhouseDataSource } from "../dataSources"

interface SelectDataSourceProps {
    previousBoardToken?: string | null
    onSelectBoardToken: (boardToken: string) => void
    previousDataSourceId?: string | null
    onSelectDataSource: (dataSource: GreenhouseDataSource) => void
}

export function SelectDataSource({
    previousBoardToken,
    onSelectBoardToken,
    previousDataSourceId,
    onSelectDataSource,
}: SelectDataSourceProps) {
    const [boardToken, setBoardToken] = useState<string>(previousBoardToken ?? "")
    const [selectedDataSourceId, setSelectedDataSourceId] = useState<string>(
        previousDataSourceId ?? dataSources[0]?.id ?? ""
    )
    const [isLoading, setIsLoading] = useState(false)

    const isAllowedToManage = useIsAllowedTo("ManagedCollection.setFields", ...syncMethods)

    const handleSubmit = useCallback(
        (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault()

            setIsLoading(true)

            getDataSource(boardToken, selectedDataSourceId)
                .then(dataSource => {
                    onSelectDataSource(dataSource)
                    onSelectBoardToken(boardToken)
                })
                .catch((error: unknown) => {
                    console.error(error)
                    framer.notify(error instanceof Error ? error.message : "An unknown error occurred", {
                        variant: "error",
                    })
                })
                .finally(() => {
                    setIsLoading(false)
                })
        },
        [boardToken, selectedDataSourceId, onSelectDataSource, onSelectBoardToken]
    )

    const isButtonDisabled = !boardToken || !selectedDataSourceId || isLoading || !isAllowedToManage

    return (
        <main className="framer-hide-scrollbar setup">
            <img src={hero} alt="Greenhouse Hero" />

            <form onSubmit={handleSubmit}>
                <label>
                    <p>Board Token</p>
                    <input
                        id="boardToken"
                        type="text"
                        required
                        placeholder="Enter Board Token…"
                        value={boardToken}
                        onChange={event => {
                            setBoardToken(event.target.value)
                        }}
                    />
                </label>
                <label>
                    <p>Collection</p>
                    <select
                        id="collection"
                        required
                        onChange={event => {
                            setSelectedDataSourceId(event.target.value)
                        }}
                        value={selectedDataSourceId}
                        disabled={!boardToken}
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
                <button disabled={isButtonDisabled}>{isLoading ? <div className="framer-spinner" /> : "Next"}</button>
            </form>
        </main>
    )
}
