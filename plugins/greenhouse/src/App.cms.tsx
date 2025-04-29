import "./App.css"

import { framer, type ManagedCollection } from "framer-plugin"
import { useEffect, useLayoutEffect, useState } from "react"
import { type DataSource, getDataSource } from "./data"
import { FieldMapping } from "./components/FieldMapping"
import { SelectDataSource } from "./components/SelectDataSource"
import { Auth } from "./components/auth"
import { useCollections } from "./hooks/use-collections"

interface AppProps {
    collection: ManagedCollection
    previousDataSourceId: string | null
    previousSlugFieldId: string | null
}

export function App({ collection, previousDataSourceId, previousSlugFieldId }: AppProps) {
    const [dataSource, setDataSource] = useState<DataSource | null>(null)
    const [isLoadingDataSource, setIsLoadingDataSource] = useState(Boolean(previousDataSourceId))
    const [spaceId, setSpaceId] = useState<string | null>(null)

    useLayoutEffect(() => {
        if (!dataSource) return

        framer.showUI({
            width: 360,
            height: 425,
            minWidth: 360,
            minHeight: 425,
            resizable: true,
        })
    }, [dataSource])

    // useEffect(async () => {
    //     const managedCollections = await framer.getManagedCollections()
    //     console.log(managedCollections)
    //     console.log(framer)

    //     // setInterval(() => {
    //     managedCollections[Math.round(Math.random())].setAsActive()
    //     // }, 1000)

    //     //
    // }, [])

    useEffect(() => {
        if (!previousDataSourceId || !spaceId) {
            return
        }

        const abortController = new AbortController()

        setIsLoadingDataSource(true)
        getDataSource(previousDataSourceId, abortController.signal)
            .then(setDataSource)
            .catch(error => {
                if (abortController.signal.aborted) return

                console.error(error)
                framer.notify(
                    `Error loading previously configured data source “${previousDataSourceId}”. Check the logs for more details.`,
                    {
                        variant: "error",
                    }
                )
            })
            .finally(() => {
                if (abortController.signal.aborted) return

                setIsLoadingDataSource(false)
            })

        return () => {
            abortController.abort()
        }
    }, [previousDataSourceId, spaceId])

    const collections = useCollections()

    console.log({ collections })

    if (!spaceId) {
        return (
            <Auth
                onSubmit={spaceId => {
                    setSpaceId(spaceId)
                    console.log("onSubmit", spaceId)
                }}
            />
        )
    }

    if (isLoadingDataSource) {
        return (
            <main className="loading">
                <div className="framer-spinner" />
            </main>
        )
    }

    if (!dataSource) {
        return <SelectDataSource onSelectDataSource={setDataSource} />
    }

    return <FieldMapping collection={collection} dataSource={dataSource} initialSlugFieldId={previousSlugFieldId} />
}
