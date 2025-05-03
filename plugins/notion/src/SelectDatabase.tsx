import type { GetDatabaseResponse } from "@notionhq/client/build/src/api-endpoints"
import { type FormEvent, useEffect, useRef, useState } from "react"
import notionConnectSrc from "./assets/notion-connect.png"
import { richTextToPlainText, useDatabasesQuery } from "./notion"
import { assert } from "./utils"
import { Button } from "./components/Button"

interface SelectDatabaseProps {
    onDatabaseSelected: (database: GetDatabaseResponse) => void
}

export function SelectDatabase({ onDatabaseSelected }: SelectDatabaseProps) {
    const { data, refetch, isRefetching, isLoading } = useDatabasesQuery()
    const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null)

    const hasBeenFocussedRef = useRef(false)
    const isLoadingOrFetching = isLoading || isRefetching

    useEffect(() => {
        if (isLoadingOrFetching) return

        function handleFocus() {
            if (hasBeenFocussedRef.current) {
                refetch()
            } else {
                hasBeenFocussedRef.current = true
            }
        }

        window.addEventListener("focus", handleFocus)

        return () => {
            window.removeEventListener("focus", handleFocus)
        }
    }, [refetch, isLoadingOrFetching])

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

    const selectEnabled = !isLoadingOrFetching && Boolean(data && data.length > 0)

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
                        onChange={event => setSelectedDatabase(event.target.value)}
                        className="flex-1 shrink-1"
                        disabled={!selectEnabled}
                    >
                        {isLoadingOrFetching && (
                            <option disabled selected>
                                Loading…
                            </option>
                        )}
                        {!isLoadingOrFetching && (
                            <>
                                <option disabled selected>
                                    Select Database…
                                </option>
                                {(!data || data.length === 0) && <option disabled>No databases…</option>}
                                {data?.map(database => {
                                    const label = richTextToPlainText(database.title)
                                    return (
                                        <option key={database.id} value={database.id}>
                                            {label.trim() ? label : "Untitled"}
                                        </option>
                                    )
                                })}
                            </>
                        )}
                    </select>
                </div>

                <Button type="submit" variant="primary" disabled={!selectedDatabase}>
                    Next
                </Button>
            </div>
        </form>
    )
}
