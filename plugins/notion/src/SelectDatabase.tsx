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
        <form className="flex flex-col gap-4 w-full" onSubmit={handleSubmit}>
            <img src={notionConnectSrc} className="rounded-md" />
            <p>
                Connect your databases: open a database in Notion, click the ... button in the top-right corner of the
                page, then pick Connections → Connect to → Framer.
            </p>
            <div className="inline-flex gap-2 items-center">
                <span>Database</span>
                <button
                    className="w-[32px] h[16px] bg-transparent flex items-center justify-center text-secondary"
                    type="button"
                    onClick={() => refetch()}
                >
                    <ReloadIcon className={isRefetching || isLoading ? "animate-spin" : undefined} />
                </button>
                <select
                    value={selectedDatabase ?? ""}
                    onChange={e => setSelectedDatabase(e.target.value)}
                    className="ml-auto min-w-[50%]"
                    disabled={data && data.length === 0}
                >
                    {isLoading && <option>Loading...</option>}
                    {data && data.length === 0 && <option>No databases...</option>}
                    {data?.map(database => (
                        <option key={database.id} value={database.id}>
                            {richTextToPlainText(database.title)}
                        </option>
                    ))}
                </select>
            </div>
            <button className="framer-button-primary" type="submit" disabled={!selectedDatabase}>
                Next
            </button>
        </form>
    )
}
