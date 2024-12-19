import { framer } from "framer-plugin"
import "./App.css"
import { useLayoutEffect, useState } from "react"
import {
    computeFieldConfigs,
    DataSource,
    FieldConfig,
    getDataSources,
    listDataSourcesIds,
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
    savedFieldsConfig = computeFieldConfigs(existingFields, syncDataSource)
}

if (framer.mode === "syncManagedCollection" && savedFieldsConfig && syncDataSource && syncSlugFieldId) {
    try {
        await syncCollection(
            syncDataSource,
            savedFieldsConfig.filter(field => field.field && !field.isNew),
            syncSlugFieldId
        )
        await framer.closePlugin(`Synchronization successful`, {
            variant: "success",
        })
    } catch (error) {
        console.error(error)
        framer.closePlugin(`Failed to sync collection`, {
            variant: "error",
        })
    }
}

const allDataSources = await listDataSourcesIds()

export function App() {
    const [isLoadingFields, setIsLoadingFields] = useState(false)

    const [selectedDataSourceId, setSelectedDataSourceId] = useState<string | null>(
        syncDataSourceId || allDataSources[0] || null
    )
    const [selectDataSource, setSelectDataSource] = useState<DataSource | null>(syncDataSource)

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
        const height = isLoadingFields ? 95 : 113

        framer.showUI({
            width,
            height,
            resizable: false,
        })
    }, [selectDataSource, isLoadingFields])

    if (!selectDataSource) {
        return (
            <main className="setup">
                <p>Select a collection to sync with Framer.</p>

                <form onSubmit={showFieldsMapping}>
                    <label htmlFor="collection">
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
