import "./App.css"

import { framer, type ManagedCollection } from "framer-plugin"
import { useEffect, useLayoutEffect, useState } from "react"
import { FieldMapping } from "./components/FieldMapping"
import { Loading } from "./components/Loading"
import { SelectDataSource } from "./components/SelectDataSource"
import {companyIdPluginKey, getDataSource, spaceIdPluginKey} from "./data"
import type { RecruiteeDataSource } from "./dataSources"

interface AppProps {
    collection: ManagedCollection
    previousDataSourceId: string | null
    previousSlugFieldId: string | null
    previousBoardToken: string | null
    previousCompanyId: string | null
}

export function App({ collection, previousDataSourceId, previousSlugFieldId, previousBoardToken, previousCompanyId }: AppProps) {
    const [boardToken, setBoardToken] = useState<string>(previousBoardToken ?? "")
    const [companyId, setCompanyId] = useState<string>(previousCompanyId ?? "")
    const [dataSource, setDataSource] = useState<RecruiteeDataSource | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useLayoutEffect(() => {
        const hasDataSourceSelected = Boolean(dataSource)

        framer.showUI({
            width: hasDataSourceSelected ? 400 : 320,
            height: hasDataSourceSelected ? 427 : 325,
            minHeight: hasDataSourceSelected ? 427 : undefined,
            minWidth: hasDataSourceSelected ? 400 : undefined,
            resizable: hasDataSourceSelected,
        })
    }, [dataSource])

    useEffect(() => {
        if (!previousBoardToken || !previousDataSourceId || !previousCompanyId) return

        setIsLoading(true)
        getDataSource(previousCompanyId, previousBoardToken, previousDataSourceId)
            .then(setDataSource)
            .catch(error => {
                console.error(`Error loading previously configured data source “${previousDataSourceId}”.`, error)
                framer.notify(`Error loading previously configured data source “${previousDataSourceId}”.`, {
                    variant: "error",
                })
            })
            .finally(() => {
                setIsLoading(false)
            })
    }, [previousCompanyId, previousDataSourceId, previousBoardToken])

    useEffect(() => {
        if (!boardToken) return
        if (boardToken === previousBoardToken) return

        if (framer.isAllowedTo("setPluginData")) {
            framer.setPluginData(spaceIdPluginKey, boardToken)
        }
    }, [boardToken, previousBoardToken])

    useEffect(() => {
        if (!companyId) return
        if (companyId === previousCompanyId) return

        if (framer.isAllowedTo("setPluginData")) {
            framer.setPluginData(companyIdPluginKey, companyId)
        }
    },[companyId, previousCompanyId])

    if (isLoading) {
        return <Loading />
    }

    if (!boardToken || !dataSource) {
        return (
            <SelectDataSource
                previousCompanyId={previousCompanyId}
                onSelectCompanyId={setCompanyId}
                onSelectBoardToken={setBoardToken}
                onSelectDataSource={setDataSource}
                previousDataSourceId={previousDataSourceId}
                previousBoardToken={previousBoardToken}
            />
        )
    }

    return (
        <FieldMapping
            collection={collection}
            companyId={companyId}
            boardToken={boardToken}
            dataSource={dataSource}
            initialSlugFieldId={previousSlugFieldId}
        />
    )
}
