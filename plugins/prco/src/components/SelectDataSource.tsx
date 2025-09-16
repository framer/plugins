import { framer, useIsAllowedTo } from "framer-plugin"
import { useCallback, useState } from "react"
import hero from "../assets/hero.png"
import { getDataSource, syncMethods } from "../data"
import { dataSources, type PrcoDataSource } from "../dataSources"

interface SelectDataSourceProps {
    previousPressRoomId?: string | null
    onSelectPressRoomId: (pressRoomId: string) => void
    previousDataSourceId?: string | null
    onSelectDataSource: (dataSource: PrcoDataSource) => void
}

export function SelectDataSource({
    previousPressRoomId,
    onSelectPressRoomId,
    previousDataSourceId,
    onSelectDataSource,
}: SelectDataSourceProps) {
    const [pressRoomId, setPressRoomId] = useState<string>(previousPressRoomId ?? "")
    const [selectedDataSourceId, setSelectedDataSourceId] = useState<string>(
        previousDataSourceId ?? dataSources[0]?.id ?? ""
    )
    const [isLoading, setIsLoading] = useState(false)

    const isAllowedToManage = useIsAllowedTo("ManagedCollection.setFields", ...syncMethods)

    const handleSubmit = useCallback(
        (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            setIsLoading(true)
            getDataSource(pressRoomId, selectedDataSourceId)
                .then(dataSource => {
                    onSelectDataSource(dataSource)
                    onSelectPressRoomId(pressRoomId)
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
        [pressRoomId, selectedDataSourceId, onSelectPressRoomId, onSelectDataSource]
    )

    const isButtonDisabled = !pressRoomId || !selectedDataSourceId || isLoading || !isAllowedToManage

    return (
        <main className="framer-hide-scrollbar setup">
            {<img src={hero} alt="PR.co Hero" />}

            <form onSubmit={handleSubmit}>
                <label>
                    <p>Press Room ID</p>
                    <input
                        id="pressRoomId"
                        type="text"
                        required
                        placeholder="Enter Room ID…"
                        value={pressRoomId}
                        onChange={event => {
                            setPressRoomId(event.target.value)
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
                        disabled={!pressRoomId}
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
