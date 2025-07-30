import { framer, useIsAllowedTo } from "framer-plugin"
import { useCallback, useState } from "react"
import hero from "../assets/hero.png"
import { getDataSource, syncMethods } from "../data"
import { type AshbyDataSource, dataSources } from "../dataSources"

interface SelectDataSourceProps {
    previousJobBoardName?: string | null
    onSelectJobBoardName: (jobBoardName: string) => void
    previousDataSourceId?: string | null
    onSelectDataSource: (dataSource: AshbyDataSource) => void
}

export function SelectDataSource({
    previousJobBoardName,
    onSelectJobBoardName,
    previousDataSourceId,
    onSelectDataSource,
}: SelectDataSourceProps) {
    const [jobBoardName, setJobBoardName] = useState<string>(previousJobBoardName ?? "")
    const [selectedDataSourceId] = useState<string>(previousDataSourceId ?? dataSources[0]?.id ?? "")
    const [isLoading, setIsLoading] = useState(false)

    const isAllowedToManage = useIsAllowedTo("ManagedCollection.setFields", ...syncMethods)

    const handleSubmit = useCallback(
        (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault()

            setIsLoading(true)

            getDataSource(jobBoardName, selectedDataSourceId)
                .then(dataSource => {
                    onSelectDataSource(dataSource)
                    onSelectJobBoardName(jobBoardName)
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
        [jobBoardName, selectedDataSourceId, onSelectDataSource, onSelectJobBoardName]
    )

    const isButtonDisabled = !jobBoardName || !selectedDataSourceId || isLoading || !isAllowedToManage

    return (
        <main className="framer-hide-scrollbar setup">
            <img src={hero} alt="Ashby Hero" />

            <form onSubmit={handleSubmit}>
                <div>
                    <p>Board Token</p>
                    <input
                        id="jobBoardName"
                        type="text"
                        required
                        placeholder="Enter Board Token…"
                        value={jobBoardName}
                        onChange={event => {
                            setJobBoardName(event.target.value)
                        }}
                    />
                </div>
                <button disabled={isButtonDisabled}>{isLoading ? <div className="framer-spinner" /> : "Next"}</button>
            </form>
        </main>
    )
}
