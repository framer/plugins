import "./App.css"

import { framer, type ManagedCollection } from "framer-plugin"
import { useEffect, useLayoutEffect, useState } from "react"
import { type DataSource, getDataSource, PLUGIN_KEYS } from "./data"
import { FieldMapping } from "./components/FieldMapping"
import { SelectDataSource } from "./components/SelectDataSource"

interface AppProps {
    collection: ManagedCollection
    previousDataSourceId: string | null
    previousSlugFieldId: string | null
    previousBoardToken: string | null
}

export function App({ collection, previousDataSourceId, previousSlugFieldId, previousBoardToken }: AppProps) {
    const [dataSource, setDataSource] = useState<DataSource | null>(null)
    const [isLoading, setIsLoading] = useState(Boolean(previousDataSourceId || previousBoardToken))
    const [boardToken, setBoardToken] = useState<string | null>(previousBoardToken)

    useEffect(() => {
        if (boardToken) {
            // this will be the default board token for the plugin
            framer.setPluginData(PLUGIN_KEYS.SPACE_ID, boardToken)

            // this will be the board token for the collection
            collection.setPluginData(PLUGIN_KEYS.SPACE_ID, boardToken)
        }
    }, [boardToken, collection])

    useLayoutEffect(() => {
        const hasDataSourceSelected = Boolean(dataSource)

        framer.showUI({
            width: hasDataSourceSelected ? 320 : 320,
            height: hasDataSourceSelected ? 427 : 325,
            minHeight: hasDataSourceSelected ? 427 : undefined,
            resizable: hasDataSourceSelected,
        })
    }, [dataSource])

    useEffect(() => {
        const abortController = new AbortController()

        async function init() {
            setIsLoading(true)

            try {
                if (!previousBoardToken) return
                const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${previousBoardToken}`, {
                    signal: abortController.signal,
                })
                if (response.status === 200) {
                    setBoardToken(previousBoardToken)
                } else {
                    throw new Error(
                        `Error loading previously configured board “${previousBoardToken}”. Check the logs for more details.`
                    )
                }

                if (!previousDataSourceId) return
                const dataSource = await getDataSource(previousDataSourceId, abortController.signal)
                if (dataSource) {
                    setDataSource(dataSource)
                } else {
                    throw new Error(
                        `Error loading previously configured data source “${previousDataSourceId}”. Check the logs for more details.`
                    )
                }
            } catch (error) {
                if (abortController.signal.aborted) return
                console.error(error)
                framer.notify(error instanceof Error ? error.message : "An unknown error occurred", {
                    variant: "error",
                })
            } finally {
                if (!abortController.signal.aborted) {
                    setIsLoading(false)
                }
            }
        }

        init()

        return () => {
            abortController.abort()
        }
    }, [previousDataSourceId, previousBoardToken])

    if (isLoading) {
        return (
            <main className="loading">
                <div className="framer-spinner" />
            </main>
        )
    }

    if (!dataSource) {
        return (
            <SelectDataSource
                onSelectBoardToken={setBoardToken}
                onSelectDataSource={setDataSource}
                previousDataSourceId={previousDataSourceId}
                previousBoardToken={previousBoardToken}
            />
        )
    }

    return <FieldMapping collection={collection} dataSource={dataSource} initialSlugFieldId={previousSlugFieldId} />
}
