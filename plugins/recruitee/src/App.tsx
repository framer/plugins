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
    previousCompanyId: string | null
}

export function App({ collection, previousDataSourceId, previousSlugFieldId, previousBoardToken,previousCompanyId }: AppProps) {
    const [dataSource, setDataSource] = useState<DataSource | null>(null)
    const [isLoading, setIsLoading] = useState(Boolean(previousDataSourceId || previousBoardToken))

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
            try {
                if (!previousBoardToken || !previousDataSourceId || !previousCompanyId) return

                setIsLoading(true)

                const dataSource = await getDataSource(previousCompanyId, previousBoardToken, previousDataSourceId, abortController.signal)
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
    }, [previousDataSourceId, previousBoardToken, previousCompanyId])

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
                onSelectDataSource={dataSource => {
                    setDataSource(dataSource)
                    framer.setPluginData(PLUGIN_KEYS.SPACE_ID, dataSource.boardToken)
                    framer.setPluginData(PLUGIN_KEYS.COMPANY_ID, dataSource.companyId)
                }}
                previousDataSourceId={previousDataSourceId}
                previousBoardToken={previousBoardToken}
                previousCompanyId={previousCompanyId}
            />
        )
    }

    return <FieldMapping collection={collection} dataSource={dataSource} initialSlugFieldId={previousSlugFieldId} />
}