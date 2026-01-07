import type { Collection } from "framer-plugin"
import { FramerPluginClosedError, framer, useIsAllowedTo } from "framer-plugin"
import { useCallback, useState } from "react"
import "./App.css"
import { useMiniRouter } from "./minirouter"
import { FieldMapper, type FieldMappingItem, type MissingFieldItem } from "./routes/FieldMapper"
import { Home } from "./routes/Home"
import { ManageConflicts } from "./routes/ManageConflicts"
import {
    createNewFieldsInCms as applyFieldCreationsToCms,
    removeFieldsFromCms as applyFieldRemovalsToCms,
} from "./utils/fieldReconciliation"
import { importCSV as loadDataToCms } from "./utils/importCSV"
import { parseCSV } from "./utils/parseCSV"
import { ImportError, type ImportItem, prepareImportPayload } from "./utils/prepareImportPayload"

export function App({ initialCollection }: { initialCollection: Collection | null }) {
    const [collection, setCollection] = useState<Collection | null>(initialCollection)
    const hasAllPermissions = useIsAllowedTo(
        "Collection.addItems",
        "Collection.addFields",
        "Collection.removeFields",
        "createCollection"
    )

    const { currentRoute, navigate } = useMiniRouter()

    const handleFileSelected = useCallback(
        async (csvContent: string) => {
            if (!collection) return
            if (!hasAllPermissions) return

            try {
                const csvRecords = await parseCSV(csvContent)
                if (csvRecords.length === 0) {
                    throw new Error("No records found in CSV")
                }

                await navigate({
                    uid: "field-mapper",
                    opts: { collection, csvRecords },
                })
            } catch (error) {
                if (error instanceof FramerPluginClosedError) {
                    throw error
                }

                console.error(error)

                if (error instanceof ImportError || error instanceof Error) {
                    framer.notify(error.message, { variant: "error" })
                    return
                }

                framer.notify("Error processing CSV file. Check console for details.", {
                    variant: "error",
                })
            }
        },
        [collection, hasAllPermissions, navigate]
    )

    const handleFieldMapperSubmit = useCallback(
        async (opts: {
            collection: Collection
            csvRecords: Record<string, string>[]
            mappings: FieldMappingItem[]
            slugFieldName: string
            missingFields: MissingFieldItem[]
        }) => {
            if (!hasAllPermissions) return

            try {
                await applyFieldRemovalsToCms(opts.collection, opts.missingFields)
                await applyFieldCreationsToCms(opts.collection, opts.mappings)

                // Process records with field mapping
                const payload = await prepareImportPayload({
                    collection: opts.collection,
                    csvRecords: opts.csvRecords,
                    slugFieldName: opts.slugFieldName,
                    mappings: opts.mappings,
                })

                const itemsWithConflict = payload.items.filter(item => item.action === "conflict")
                if (itemsWithConflict.length > 0) {
                    const resolutions = await new Promise<ImportItem[]>(resolve => {
                        void navigate({
                            uid: "manage-conflicts",
                            opts: {
                                conflicts: itemsWithConflict,
                                result: payload,
                                onComplete(items) {
                                    resolve(items)
                                },
                            },
                        })
                    })

                    payload.items = payload.items.map(
                        item => resolutions.find(resolved => resolved.slug === item.slug) ?? item
                    )
                }

                await navigate({ uid: "home", opts: undefined })

                await loadDataToCms(opts.collection, payload)

                await framer.hideUI()
            } catch (error) {
                if (error instanceof FramerPluginClosedError) {
                    throw error
                }

                console.error(error)

                if (error instanceof ImportError || error instanceof Error) {
                    framer.notify(error.message, { variant: "error" })
                    return
                }

                framer.notify("Error processing CSV file. Check console for details.", {
                    variant: "error",
                })
            }
        },
        [hasAllPermissions, navigate]
    )

    switch (currentRoute.uid) {
        case "home": {
            return (
                <Home
                    collection={collection}
                    forceCreateCollection={currentRoute.opts?.forceCreateCollection}
                    onCollectionChange={setCollection}
                    onFileSelected={handleFileSelected}
                />
            )
        }
        case "field-mapper":
            return (
                <FieldMapper
                    collection={currentRoute.opts.collection}
                    csvRecords={currentRoute.opts.csvRecords}
                    onSubmit={opts =>
                        handleFieldMapperSubmit({
                            collection: currentRoute.opts.collection,
                            csvRecords: currentRoute.opts.csvRecords,
                            mappings: opts.mappings,
                            slugFieldName: opts.slugFieldName,
                            missingFields: opts.missingFields,
                        })
                    }
                    onCancel={async () => {
                        await navigate({ uid: "home", opts: undefined })
                    }}
                />
            )
        case "manage-conflicts": {
            return (
                <ManageConflicts
                    records={currentRoute.opts.conflicts}
                    onAllConflictsResolved={currentRoute.opts.onComplete}
                />
            )
        }
        default:
            // @ts-expect-error -- exhaustive switch
            return <div>Unknown route {currentRoute.uid}</div>
    }
}
