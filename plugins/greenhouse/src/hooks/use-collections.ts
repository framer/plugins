import { Collection, framer } from "framer-plugin"
import { useEffect, useMemo, useState } from "react"
import pkg from "../../package.json"
import { useStore } from "../store"

type CollectionWithContentTypeId = { id: string; name: string; contentTypeId: string }

export function useCollections(): CollectionWithContentTypeId[] {
    const [framerCollections, setFramerCollections] = useState<Collection[]>([])
    const [collections, setCollections] = useState<CollectionWithContentTypeId[]>([])
    const contentTypeId = useStore(state => state.contentTypeId)

    useEffect(() => {
        if (!contentTypeId) return

        const get = async () => {
            const framerCollections = await framer.getCollections()
            const serializedCollections = await framer.getPluginData(`${pkg.name}:collections`)
            let collections = JSON.parse(serializedCollections ?? "[]") as CollectionWithContentTypeId[]
            const managedCollection = await framer.getActiveManagedCollection()

            if (!collections.find(collection => collection.id === managedCollection.id)) {
                collections.push({ ...managedCollection, contentTypeId })
            }

            collections.forEach(collection => {
                if (!framerCollections.find(framerCollection => framerCollection.id === collection.id)) {
                    collections = collections.filter(({ id }) => id !== collection.id)
                }
            })

            await framer.setPluginData(`${pkg.name}:collections`, JSON.stringify(collections))

            setFramerCollections(framerCollections)
            setCollections(collections)
        }

        get()
    }, [contentTypeId])

    const mappedCollections = useMemo(
        () =>
            collections
                .map(collection => {
                    const name = framerCollections.find(
                        framerCollection => framerCollection.id === collection?.id
                    )?.name
                    return {
                        ...collection,
                        name,
                    }
                })
                .filter(Boolean) as CollectionWithContentTypeId[],
        [collections, framerCollections]
    )

    return mappedCollections
}
