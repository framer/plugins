import { framer } from "framer-plugin"
import "./App.css"
import { useLayoutEffect, useState } from "react"
import {
    COLLECTIONS_SYNC_MAP,
    computeFieldConfig,
    DataSource,
    FieldConfig,
    getDataSources,
    listDataSourcesIds,
    LOCAL_STORAGE_LAST_LAUNCH_KEY,
    PLUGIN_COLLECTION_SYNC_REFERENCE_KEY,
    PLUGIN_COLLECTION_SYNC_SLUG_KEY,
    syncCollection,
} from "./data"
import { FieldMapping } from "./FieldMapping"

const activeCollection = await framer.getManagedCollection()
const existingFields = activeCollection ? await activeCollection.getFields() : []

const syncDataSourceId = await activeCollection.getPluginData(PLUGIN_COLLECTION_SYNC_REFERENCE_KEY)
const syncSlugFieldId = await activeCollection.getPluginData(PLUGIN_COLLECTION_SYNC_SLUG_KEY)

const syncDataSource = syncDataSourceId ? await getDataSources(syncDataSourceId) : null

let savedFieldsConfig: FieldConfig[] | undefined

if (syncDataSource) {
    savedFieldsConfig = computeFieldConfig(existingFields, syncDataSource)
}

if (framer.mode === "syncManagedCollection" && savedFieldsConfig && syncDataSource && syncSlugFieldId) {
    await syncCollection(
        syncDataSource,
        savedFieldsConfig
            .filter(field => field.field && !field.source.ignored)
            .filter(field => !field.reference || field.reference.destination !== null),
        syncSlugFieldId
    )
}

const allDataSources = await listDataSourcesIds()

export function App() {
    const [isFirstTime, setIsFirstTime] = useState(localStorage.getItem(LOCAL_STORAGE_LAST_LAUNCH_KEY) === null)
    const [isLoadingFields, setIsLoadingFields] = useState(false)

    const [selectedDataSourceId, setSelectedDataSourceId] = useState<string | null>(
        syncDataSourceId || allDataSources[0] || null
    )
    const [selectDataSource, setSelectDataSource] = useState<DataSource | null>(syncDataSource)

    const showCollections = () => {
        localStorage.setItem(LOCAL_STORAGE_LAST_LAUNCH_KEY, new Date().toISOString())
        setIsFirstTime(false)
    }

    const showFieldsMapping = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!selectedDataSourceId) {
            framer.notify("Please select a data source", { variant: "error" })
            return
        }

        setIsLoadingFields(true)

        try {
            const dataSource = await getDataSources(selectedDataSourceId)
            if (!dataSource) {
                throw new Error("Failed to load data source")
            }

            setSelectDataSource(dataSource)

            const collectionReferences = COLLECTIONS_SYNC_MAP.get(dataSource.id) ?? []
            if (!collectionReferences.find(reference => reference.id === activeCollection.id)) {
                COLLECTIONS_SYNC_MAP.set(dataSource.id, [
                    ...collectionReferences,
                    {
                        id: activeCollection.id,
                        name: "This Collection",
                    },
                ])
            }
        } catch (error) {
            framer.notify(`Failed to load collection: ${error instanceof Error ? error.message : "Unknown error"}`, {
                variant: "error",
            })
        } finally {
            setIsLoadingFields(false)
        }
    }

    useLayoutEffect(() => {
        if (selectDataSource) return
        const width = 320
        const height = isLoadingFields ? 95 : isFirstTime ? 127 : 113

        framer.showUI({
            width,
            height,
            resizable: false,
        })
    }, [selectDataSource, isFirstTime, isLoadingFields])

    if (isFirstTime) {
        return (
            <main className="intro-container">
                <p>
                    This is a starter for the CMS plugin. Laboris duis dolore culpa culpa sint do. In commodo aliquip
                    consequat qui sit laboris cillum veniam voluptate irure.
                </p>
                <button onClick={showCollections}>Start</button>
            </main>
        )
    }

    if (!selectDataSource) {
        return (
            <main className="intro-container">
                <p>Select a collection to sync with Framer.</p>

                <form className="collection-form" onSubmit={showFieldsMapping}>
                    <label htmlFor="collection" className="collection-label">
                        Collection
                        <select
                            id="collection"
                            onChange={e => setSelectedDataSourceId(e.target.value)}
                            value={selectedDataSourceId || ""}
                            className="collection-select"
                        >
                            <option value="" disabled>
                                Choose...
                            </option>
                            {allDataSources.map(collectionId => (
                                <option key={collectionId} value={collectionId}>
                                    {collectionId}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button disabled={!selectedDataSourceId || isLoadingFields}>
                        {isLoadingFields ? "Loading..." : "Next"}
                    </button>
                </form>
            </main>
        )
    }

    return (
        <FieldMapping
            dataSource={selectDataSource}
            savedFieldsConfig={savedFieldsConfig}
            existingFields={existingFields}
            savedSlugFieldId={syncSlugFieldId}
            onSubmit={syncCollection}
        />
    )
}
