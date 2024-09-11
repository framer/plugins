import { GetDatabaseResponse } from "@notionhq/client/build/src/api-endpoints"
import { richTextToPlainText, useDatabasesQuery } from "./notion"
import { FormEvent, useEffect, useState } from "react"
import notionConnectSrc from "./assets/notion-connect.png"
import { assert } from "./utils"
import { ReloadIcon } from "./components/Icons"

interface SelectDatabaseProps {
    onDatabaseSelected: (database: GetDatabaseResponse) => void
}

export function SelectDatabase({ onDatabaseSelected }: SelectDatabaseProps) {
    const { data, refetch, isRefetching, isLoading } = useDatabasesQuery()
    const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null)

    useEffect(() => {
        const firstItem = data?.[0]
        if (!firstItem) return

        if (selectedDatabase || data?.some(database => database.id === selectedDatabase)) return

        setSelectedDatabase(selectedDatabase => {
            const firstItem = data?.[0]
            if (!firstItem) return selectedDatabase

            if (selectedDatabase && data.some(database => database.id === selectedDatabase)) return null

            return firstItem.id
        })
    }, [data, selectedDatabase])

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault()

        assert(data)

        const database = data.find(database => database.id === selectedDatabase)
        if (!database) {
            setSelectedDatabase(null)
            return
        }

        onDatabaseSelected(database)
    }

    return (
        <form className="flex flex-col gap-[10px] w-full h-full" onSubmit={handleSubmit}>
            <img src={notionConnectSrc} className="rounded-md" />

            <p>
                To manually connect a database, open it in Notion, click on the three dots icon in the top right corner,
                then select Connections and connect to Framer.
            </p>

            <div className="flex flex-col gap-[10px] mt-auto pb-[15px]">
                <div className="flex gap-[10px]">
                    <select
                        value={selectedDatabase ?? ""}
                        onChange={e => setSelectedDatabase(e.target.value)}
                        className="flex-1 shrink-1"
                        disabled={data && data.length === 0}
                    >
                        {isLoading && (
                            <option disabled selected>
                                Loading…
                            </option>
                        )}
                        {!isLoading && (
                            <option disabled selected>
                                Select Database…
                            </option>
                        )}
                        {data && data.length === 0 && <option>No databases...</option>}
                        {data?.map(database => {
                            const label = richTextToPlainText(database.title)
                            return (
                                <option key={database.id} value={database.id}>
                                    {label.trim() ? label : "Untitled"}
                                </option>
                            )
                        })}
                    </select>

                    <button
                        className="w-[32px] h[16px] flex items-center justify-center text-secondary"
                        type="button"
                        onClick={() => refetch()}
                    >
                        <ReloadIcon className={isRefetching || isLoading ? "animate-spin" : undefined} />
                    </button>
                </div>

                <button type="submit" disabled={!selectedDatabase}>
                    Next
                </button>
            </div>
        </form>
    )
}
