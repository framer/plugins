import { framer, useIsAllowedTo } from "framer-plugin"
import { useCallback, useState } from "react"
import hero from "../assets/hero.png"
import { getDataSource, syncMethods } from "../data"
import { dataSources, type RecruiteeDataSource } from "../dataSources"

interface SelectDataSourceProps {
    previousCompanyId?: string | null
    onSelectCompanyId: (companyId: string) => void
    previousToken?: string | null
    onSelectToken: (token: string) => void
    previousDataSourceId?: string | null
    onSelectDataSource: (dataSource: RecruiteeDataSource) => void
}

export function SelectDataSource({
    previousCompanyId,
    onSelectCompanyId,
    previousToken,
    onSelectToken,
    previousDataSourceId,
    onSelectDataSource,
}: SelectDataSourceProps) {
    const [token, setToken] = useState<string>(previousToken ?? "")
    const [companyId, setCompanyId] = useState<string>(previousCompanyId ?? "")
    const [selectedDataSourceId, setSelectedDataSourceId] = useState<string>(
        previousDataSourceId ?? dataSources[0]?.id ?? ""
    )
    const [isLoading, setIsLoading] = useState(false)

    const isAllowedToManage = useIsAllowedTo("ManagedCollection.setFields", ...syncMethods)

    const handleSubmit = useCallback(
        (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault()

            setIsLoading(true)

            getDataSource(companyId, token, selectedDataSourceId)
                .then(dataSource => {
                    onSelectCompanyId(companyId)
                    onSelectDataSource(dataSource)
                    onSelectToken(token)
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
        [companyId, token, selectedDataSourceId, onSelectCompanyId, onSelectToken, onSelectDataSource]
    )

    const isButtonDisabled = !companyId || !token || !selectedDataSourceId || isLoading || !isAllowedToManage

    return (
        <main className="framer-hide-scrollbar setup">
            <img src={hero} alt="Recruitee Hero" />

            <form onSubmit={handleSubmit}>
                <label>
                    <p>Company ID</p>
                    <input
                        id="companyId"
                        type="text"
                        required
                        placeholder="Enter Company ID…"
                        value={companyId}
                        onChange={event => {
                            setCompanyId(event.target.value)
                        }}
                    />
                </label>
                <label>
                    <p>Token</p>
                    <input
                        id="token"
                        type="text"
                        required
                        placeholder="Enter Token…"
                        value={token}
                        onChange={event => {
                            setToken(event.target.value)
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
                        disabled={!token}
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
