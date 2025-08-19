import "./App.css"

import { framer, type ManagedCollection } from "framer-plugin"
import { useEffect, useLayoutEffect, useState } from "react"
import { FieldMapping } from "./components/FieldMapping"
import { Loading } from "./components/Loading"
import { SelectDataSource } from "./components/SelectDataSource"
import { companyIdPluginKey, getDataSource, tokenPluginKey } from "./data"
import type { RecruiteeDataSource } from "./dataSources"

interface AppProps {
    collection: ManagedCollection
    previousDataSourceId: string | null
    previousSlugFieldId: string | null
    previousToken: string | null
    previousCompanyId: string | null
}

export function App({
    collection,
    previousDataSourceId,
    previousSlugFieldId,
    previousToken,
    previousCompanyId,
}: AppProps) {
    const [token, setToken] = useState<string>(previousToken ?? "")
    const [companyId, setCompanyId] = useState<string>(previousCompanyId ?? "")
    const [dataSource, setDataSource] = useState<RecruiteeDataSource | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useLayoutEffect(() => {
        const hasDataSourceSelected = Boolean(dataSource)

        void framer.showUI({
            width: hasDataSourceSelected ? 400 : 320,
            height: hasDataSourceSelected ? 427 : 335,
            minHeight: hasDataSourceSelected ? 427 : undefined,
            minWidth: hasDataSourceSelected ? 400 : undefined,
            resizable: hasDataSourceSelected,
        })
    }, [dataSource])

    useEffect(() => {
        if (!previousToken || !previousDataSourceId || !previousCompanyId) return

        setIsLoading(true)
        getDataSource(previousCompanyId, previousToken, previousDataSourceId)
            .then(setDataSource)
            .catch((error: unknown) => {
                console.error(`Error loading previously configured data source “${previousDataSourceId}”.`, error)
                framer.notify(`Error loading previously configured data source “${previousDataSourceId}”.`, {
                    variant: "error",
                })
            })
            .finally(() => {
                setIsLoading(false)
            })
    }, [previousCompanyId, previousDataSourceId, previousToken])

    useEffect(() => {
        if (!token) return
        if (token === previousToken) return

        if (framer.isAllowedTo("setPluginData")) {
            void framer.setPluginData(tokenPluginKey, token)
        }
    }, [token, previousToken])

    useEffect(() => {
        if (!companyId) return
        if (companyId === previousCompanyId) return

        if (framer.isAllowedTo("setPluginData")) {
            void framer.setPluginData(companyIdPluginKey, companyId)
        }
    }, [companyId, previousCompanyId])

    if (isLoading) {
        return <Loading />
    }

    if (!token || !dataSource) {
        return (
            <SelectDataSource
                previousCompanyId={previousCompanyId}
                onSelectCompanyId={setCompanyId}
                onSelectToken={setToken}
                onSelectDataSource={setDataSource}
                previousDataSourceId={previousDataSourceId}
                previousToken={previousToken}
            />
        )
    }

    return (
        <FieldMapping
            collection={collection}
            companyId={companyId}
            token={token}
            dataSource={dataSource}
            initialSlugFieldId={previousSlugFieldId}
        />
    )
}
