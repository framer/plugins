import { framer, ManagedCollection } from "framer-plugin"
import { useEffect, useState } from "react"
import { PLUGIN_KEYS } from "../data"

export interface CollectionWithDataSourceIdAndSlugField extends ManagedCollection {
    dataSourceId: string | null
    slugFieldId: string | null
}

export function useCollections() {
    const [collections, setCollections] = useState<CollectionWithDataSourceIdAndSlugField[]>([])

    useEffect(() => {
        const fetchCollections = async () => {
            console.log("fetchCollections")
            const collections = await framer.getManagedCollections()
            const collectionsWithDataSourceIdAndSlugField = await Promise.all(
                collections.map(async collection => {
                    const dataSourceId = await collection.getPluginData(PLUGIN_KEYS.DATA_SOURCE_ID)
                    const slugFieldId = await collection.getPluginData(PLUGIN_KEYS.SLUG_FIELD_ID)
                    return {
                        ...collection,
                        dataSourceId,
                        slugFieldId,
                    } as CollectionWithDataSourceIdAndSlugField
                })
            )

            setCollections(collectionsWithDataSourceIdAndSlugField)
        }
        fetchCollections()
    }, [])

    return collections
}
