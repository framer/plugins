import "./App.css"

import { framer, type ManagedCollection } from "framer-plugin"
import { useEffect, useState } from "react"
import { type DataSource, getDataSource, PLUGIN_KEYS } from "./data"
import { FieldMapping } from "./components/FieldMapping"
import { SelectDataSource } from "./components/SelectDataSource"
import { Auth } from "./components/auth"
import Page from "./page"

interface AppProps {
    collection: ManagedCollection
    previousDataSourceId: string | null
    previousSlugFieldId: string | null
    previousBoardToken: string | null
}

export function AppCms({ collection, previousDataSourceId, previousSlugFieldId, previousBoardToken }: AppProps) {
    const [dataSource, setDataSource] = useState<DataSource | null>(null)
    const [isLoading, setIsLoading] = useState(Boolean(previousDataSourceId || previousBoardToken))
    const [boardToken, setBoardToken] = useState<string | null>()

    useEffect(() => {
        if (boardToken) {
            // this will be the default board token for the plugin
            framer.setPluginData(PLUGIN_KEYS.SPACE_ID, boardToken)

            // this will be the board token for the collection
            collection.setPluginData(PLUGIN_KEYS.SPACE_ID, boardToken)
        }
    }, [boardToken, collection])

    useEffect(() => {
        framer.showUI({
            width: 360,
            height: 350,
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

    if (!boardToken) {
        return (
            <Page width={360}>
                <Auth
                    onAuth={boardToken => {
                        setBoardToken(boardToken)
                    }}
                />
            </Page>
        )
    }

    if (!dataSource) {
        return (
            <Page width={360} previousPage="Board Token" onPreviousPage={() => setBoardToken(null)}>
                <SelectDataSource onSelectDataSource={setDataSource} previousDataSourceId={previousDataSourceId} />
            </Page>
        )
    }

    return (
        <Page width={360} previousPage="Collection" onPreviousPage={() => setDataSource(null)}>
            <FieldMapping collection={collection} dataSource={dataSource} initialSlugFieldId={previousSlugFieldId} />
        </Page>
    )
}
