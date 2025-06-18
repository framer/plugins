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
        <form className="flex flex-col gap-[10px] w-full h-full select-none" onSubmit={handleSubmit}>
            <img src={notionConnectSrc} draggable={false} className="rounded-md" />

            <p>
                To manually connect a database, open it in Notion, click on the three dots icon in the top right corner,
                then select Connections and connect to Framer.
            </p>

            <div className="flex flex-col gap-[10px] mt-auto pb-[15px]">
                <div className="flex flex-row gap-[10px]">
                    <select
                        value={selectedDatabase ?? ""}
                        onChange={event => setSelectedDatabase(event.target.value)}
                        className="flex-1 shrink-1 cursor-pointer"
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
                    <a
                        href={selectedDatabase ? `https://notion.so/${selectedDatabase?.replace(/-/g, "")}` : ""}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <button type="button" disabled={!selectedDatabase} className="aspect-square w-auto p-0">
                            <LinkArrowIcon />
                        </button>
                    </a>
                </div>

                <Button type="submit" variant="primary" disabled={!selectedDatabase}>
                    Next
                </Button>
            </div>
        </form>
    )
}

function LinkArrowIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M17 7l-10 10" />
            <path d="M8 7l9 0l0 9" />
        </svg>
    )
}
