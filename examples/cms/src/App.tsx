import "./App.css"

import { framer, ManagedCollection, ManagedCollectionField } from "framer-plugin"
import { useEffect, useLayoutEffect, useState } from "react"
import { DataSource, getDataSource, getDataSourcesIds, syncCollection } from "./data"
import { FieldMapping } from "./FieldMapping"
import { SelectDataSource } from "./SelectDataSource"
import { UI_DEFAULTS } from "./constants"

interface AppProps {
    collection: ManagedCollection
    dataSourceId: string | null
    slugFieldId: string | null
}

export function App({ collection, dataSourceId, slugFieldId }: AppProps) {
    const [dataSource, setDataSource] = useState<DataSource | null>(null)
    const [existingFields, setExistingFields] = useState<ManagedCollectionField[]>([])

    useLayoutEffect(() => {
        if (!dataSource) {
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
    }, [dataSource])

    useEffect(() => {
        collection.getFields().then(setExistingFields)
    }, [collection])

    useEffect(() => {
        if (!dataSourceId) {
            return
        }

        getDataSource(dataSourceId).then(setDataSource)
    }, [dataSourceId])

    if (!dataSource) {
        return <SelectDataSource dataSources={getDataSourcesIds()} onSelectDataSource={setDataSource} />
    } else {
        return (
            <FieldMapping
                collection={collection}
                dataSource={dataSource}
                existingFields={existingFields}
                slugFieldId={slugFieldId}
                onImport={syncCollection}
            />
        )
    }
}
