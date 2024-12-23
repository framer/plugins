import { framer, ManagedCollectionField } from "framer-plugin"
import "./App.css"
import { useLayoutEffect, useState } from "react"
import { DataSource, getDataSources, syncCollection, syncExistingCollection } from "./data"
import { FieldMapping } from "./FieldMapping"
import { PLUGIN_KEYS, UI_DEFAULTS } from "./constants"
import { Spinner } from "./components/Spinner"

const activeCollection = await framer.getManagedCollection()

const syncDataSourceId = await activeCollection.getPluginData(PLUGIN_KEYS.SYNC_REFERENCE)
const syncSlugFieldId = await activeCollection.getPluginData(PLUGIN_KEYS.SYNC_SLUG)

const result = await syncExistingCollection(activeCollection, syncDataSourceId, syncSlugFieldId)

if (result.status === "success") {
    await framer.closePlugin(`Synchronization successful`, {
        variant: "success",
    })
}

export function App() {
    const [isLoadingFields, setIsLoadingFields] = useState(false)

    const [selectedDataSourceId, setSelectedDataSourceId] = useState<string | null>(() => {
        if (result.status === "needsSetup") {
            return result.allDataSources[0] || null
        }

        return syncDataSourceId || null
    })
    const [selectedDataSource, setSelectedDataSource] = useState<DataSource | null>(
        result.status === "needsConfiguration" ? result.dataSource : null
    )
    const [existingFields, setExistingFields] = useState<ManagedCollectionField[]>(
        result.status === "needsConfiguration" ? result.existingFields : []
    )

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
            setSelectedDataSource(dataSource)
            setExistingFields(await activeCollection.getFields())
        } catch (error) {
            framer.notify(`Failed to load collection: ${error instanceof Error ? error.message : "Unknown error"}`, {
                variant: "error",
            })
        } finally {
            setIsLoadingFields(false)
        }
    }

    useLayoutEffect(() => {
        if (!selectedDataSource) {
            framer.showUI({
                width: UI_DEFAULTS.SETUP_WIDTH,
                height: UI_DEFAULTS.SETUP_HEIGHT,
                resizable: false,
            })
            return
        }

        framer.showUI({
            width: UI_DEFAULTS.MAPPING_WIDTH,
            height: UI_DEFAULTS.MAPPING_HEIGHT,
            minWidth: UI_DEFAULTS.MAPPING_WIDTH,
            minHeight: UI_DEFAULTS.MAPPING_HEIGHT,
            resizable: true,
        })
    }, [selectedDataSource])

    if (result.status === "needsSetup" && !selectedDataSource) {
        return (
            <main className="setup">
                <div className="logo">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150">
                        <path
                            fill="#999"
                            d="M75 33c18.778 0 34 7.611 34 17S93.778 67 75 67s-34-7.611-34-17 15.222-17 34-17Zm34 40.333C109 82.538 93.778 90 75 90s-34-7.462-34-16.667V60c0 9.389 15.222 17 34 17 18.776 0 33.997-7.61 34-16.997v13.33ZM109 84v.497c0-.166-.005-.332-.015-.497Zm0 13.333C109 106.538 93.778 114 75 114s-34-7.462-34-16.667V84h.015c-.01.166-.015.333-.015.5 0 9.113 15.222 16.5 34 16.5 18.776 0 33.997-7.386 34-16.497v12.83Z"
                        />
                    </svg>
                </div>
                <form onSubmit={showFieldsMapping}>
                    <label htmlFor="collection">
                        Collection
                        <select
                            id="collection"
                            onChange={event => setSelectedDataSourceId(event.target.value)}
                            value={selectedDataSourceId || ""}
                        >
                            <option value="" disabled>
                                Choose...
                            </option>
                            {result.allDataSources.map(collectionId => (
                                <option key={collectionId} value={collectionId}>
                                    {collectionId}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button style={{ position: "relative" }} disabled={!selectedDataSourceId || isLoadingFields}>
                        {isLoadingFields ? <Spinner inheritColor /> : "Next"}
                    </button>
                </form>
            </main>
        )
    }

    if (selectedDataSource) {
        return (
            <FieldMapping
                dataSource={selectedDataSource}
                savedFieldsConfig={result.status === "needsConfiguration" ? result.savedFieldsConfig : null}
                existingFields={existingFields}
                savedSlugFieldId={syncSlugFieldId}
                onSubmit={syncCollection}
            />
        )
    }

    throw new Error(`Invalid state: ${result.status}`)
}
