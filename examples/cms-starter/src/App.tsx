import { CollectionItemData, framer, ManagedCollectionField } from "framer-plugin"
import "./App.css"
import { Fragment, useLayoutEffect, useMemo, useState } from "react"
import { DataSource, DataSourceFieldType, getDataSources, listDataSourcesIds } from "./data"

// Plugin keys
const PLUGIN_PREFIX = "cms_starter"
const LOCAL_STORAGE_LAST_LAUNCH_KEY = `${PLUGIN_PREFIX}.lastLaunched`

const PLUGIN_COLLECTION_SYNC_REFERENCE_KEY = `collectionSyncReference`
const PLUGIN_COLLECTION_SYNC_SLUG_KEY = `collectionSyncSlug`

// Match everything except for letters, numbers and parentheses.
const nonSlugCharactersRegExp = /[^\p{Letter}\p{Number}()]+/gu
// Match leading/trailing dashes, for trimming purposes.
const trimSlugRegExp = /^-+|-+$/gu

type SupportedCollectionFieldType = ManagedCollectionField["type"]
type SupportedCollectionFieldTypeWithoutReference = Exclude<
    SupportedCollectionFieldType,
    "collectionReference" | "multiCollectionReference"
>

/**
 * Reference fields are special fields that reference other collections.
 */
interface ReferenceField {
    type: "collectionReference" | "multiCollectionReference"
    source: string
    destination: string | null
}

/**
 * Field configuration for a managed collection field.
 */
interface FieldConfig {
    source: {
        name: string
        type: DataSourceFieldType
        ignored: boolean
    }
    field: ManagedCollectionField | null
    reference: ReferenceField | null
}

/**
 * Mapping of data source field types to managed collection field types.
 */
const FIELD_MAPPING: Record<DataSourceFieldType, SupportedCollectionFieldTypeWithoutReference[]> = {
    string: [],
    date: ["date"],
    image: ["image", "file", "link"],
    // Special case for reference fields - we need to map the reference field to the collection it references
    reference: [],
    richText: ["formattedText"],
    number: ["number"],
    boolean: ["boolean"],
    enum: ["enum"],
    color: ["color"],
}

const TYPE_NAMES: Record<SupportedCollectionFieldTypeWithoutReference, string> = {
    string: "String",
    date: "Date",
    image: "Image",
    link: "Link",
    file: "File",
    number: "Number",
    boolean: "Boolean",
    enum: "Option",
    color: "Color",
    formattedText: "Formatted Text",
}

const COLLECTIONS_SYNC_MAP: Map<
    string,
    {
        id: string
        name: string
    }[]
> = new Map()

const allExistingCollections = await framer.getCollections()
for (const collection of allExistingCollections) {
    const reference = await collection.getPluginData(PLUGIN_COLLECTION_SYNC_REFERENCE_KEY)
    if (reference) {
        const collectionReferences = COLLECTIONS_SYNC_MAP.get(reference) ?? []
        COLLECTIONS_SYNC_MAP.set(reference, [
            ...collectionReferences,
            {
                id: collection.id,
                name: collection.name,
            },
        ])
    }
}

function computeFieldConfig(existingFields: ManagedCollectionField[], dataSource: DataSource) {
    const result: FieldConfig[] = []
    const fields = dataSource.fields

    for (const [name, field] of Object.entries(fields)) {
        const fieldId = generateHashId(name)
        let newField: ManagedCollectionField | null = null

        const existingField = existingFields.find(field => field.id === fieldId)
        if (existingField) {
            newField = existingField
        } else if (field.type === "reference") {
            newField = {
                id: fieldId,
                name,
                type: field.multiple ? "multiCollectionReference" : "collectionReference",
                collectionId: COLLECTIONS_SYNC_MAP.get(field.reference)?.[0].id ?? "",
                userEditable: false,
            }
        } else {
            const fieldType = FIELD_MAPPING[field.type][0] ?? "string"
            newField = {
                id: fieldId,
                name,
                type: fieldType,
                userEditable: false,
            } as ManagedCollectionField
        }

        let reference: ReferenceField | null = null
        if (newField && field.type === "reference") {
            if (newField.type === "string") {
                reference = {
                    type: field.multiple ? "multiCollectionReference" : "collectionReference",
                    source: field.reference,
                    destination: COLLECTIONS_SYNC_MAP.get(field.reference)?.[0].id ?? null,
                }
            } else if (newField.type === "collectionReference" || newField.type === "multiCollectionReference") {
                reference = {
                    type: newField.type,
                    source: field.reference,
                    destination: newField.collectionId || null,
                }
            }

            assert(
                true,
                "Expected reference field to be mapped to a collection reference or multi collection reference"
            )
        }

        if (field.type === "enum") {
            assert(newField?.type === "enum", "Expected enum field to be mapped to an enum field")
            newField.cases = field.options.map(option => ({
                id: option,
                name: option,
            }))
        }

        result.push({
            source: {
                name,
                type: field.type,
                ignored: !existingField,
            },
            field: newField,
            reference,
        })
    }

    return result
}

const CELL_BOOLEAN_VALUES = ["Y", "yes", "true", "TRUE", "Yes", 1, true]

function getFieldValue(field: FieldConfig, value: unknown) {
    switch (field.source.type) {
        case "number": {
            const num = Number(value)
            if (isNaN(num)) {
                return null
            }

            return num
        }
        case "boolean": {
            if (typeof value !== "boolean" && typeof value !== "string" && typeof value !== "number") {
                return null
            }

            return CELL_BOOLEAN_VALUES.includes(value)
        }
        case "date": {
            if (typeof value !== "string") return null
            return new Date(value).toUTCString()
        }
        case "reference": {
            if (field.field?.type === "multiCollectionReference") {
                return String(value)
                    .split(",")
                    .map(id => generateHashId(id))
            } else if (field.field?.type === "string" || field.field?.type === "collectionReference") {
                return Array.isArray(value) ? generateHashId(value[0]) : generateHashId(String(value))
            }
            return null
        }
        case "enum":
        case "image":
        case "richText":
        case "color":
        case "string": {
            return String(value)
        }
        default:
            return null
    }
}

const activeCollection = await framer.getManagedCollection()
const existingFields = activeCollection ? await activeCollection.getFields() : []

const syncDataSourceId = await activeCollection.getPluginData(PLUGIN_COLLECTION_SYNC_REFERENCE_KEY)
const syncSlugFieldId = await activeCollection.getPluginData(PLUGIN_COLLECTION_SYNC_SLUG_KEY)

const syncDataSource = syncDataSourceId ? await getDataSources(syncDataSourceId) : null

const canSync = false

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

function FieldMapping({
    existingFields,
    dataSource,
    savedSlugFieldId,
    onSubmit,
}: {
    existingFields: ManagedCollectionField[]
    dataSource: DataSource
    savedSlugFieldId: string | null
    onSubmit: (dataSource: DataSource, fields: FieldConfig[], slugFieldId: string) => Promise<void>
}) {
    const [fields, setFields] = useState<FieldConfig[]>(
        savedFieldsConfig ?? computeFieldConfig(existingFields, dataSource)
    )
    const [disabledFieldIds, setDisabledFieldIds] = useState<Set<string>>(
        new Set(savedFieldsConfig?.filter(field => field.source.ignored).map(field => field.field!.id))
    )

    const slugFields = useMemo(
        () =>
            fields.filter(
                field => field.field && !disabledFieldIds.has(field.field.id) && field.field.type === "string"
            ),
        [fields, disabledFieldIds]
    )
    const [slugFieldId, setSlugFieldId] = useState<string | null>(savedSlugFieldId ?? slugFields[0]?.field?.id ?? null)

    const handleFieldNameChange = (fieldId: string, name: string) => {
        setFields(prev =>
            prev.map(field => (field.field?.id === fieldId ? { ...field, field: { ...field.field, name } } : field))
        )
    }

    const handleFieldToggle = (fieldId: string) => {
        setDisabledFieldIds(current => {
            const nextSet = new Set(current)
            if (nextSet.has(fieldId)) {
                nextSet.delete(fieldId)

                // If we're re-enabling a string field and there's no valid slug field,
                // set this field as the slug field
                const field = fields.find(field => field.field?.id === fieldId)
                if (field?.field?.type === "string") {
                    const currentSlugField = fields.find(field => field.field?.id === slugFieldId)
                    if (!currentSlugField || nextSet.has(slugFieldId ?? "")) {
                        setSlugFieldId(fieldId)
                    }
                }
            } else {
                nextSet.add(fieldId)

                // If the disabled field is the slug field, update it to the next
                // possible slug field
                if (fieldId === slugFieldId) {
                    const nextSlugField = slugFields.find(field => field.field?.id !== fieldId)
                    if (nextSlugField?.field && !nextSet.has(nextSlugField.field.id)) {
                        setSlugFieldId(nextSlugField.field.id)
                    }
                }
            }
            return nextSet
        })
    }

    const handleFieldTypeChange = (id: string, type: DataSourceFieldType) => {
        setFields(current =>
            current.map(field => {
                if (field.field?.id !== id) {
                    return field
                }
                // If this is a reference field and we're changing to a string type,
                // preserve the reference information but clear the destination
                if (field.reference && type === "string") {
                    return {
                        ...field,
                        field: {
                            id: field.field?.id,
                            type: "string",
                            name: field.field?.name,
                            userEditable: false,
                        } as ManagedCollectionField,
                    }
                }

                // If this is a reference field and we're changing to a collection reference,
                // use the original reference type and set the destination to the new type
                if (field.reference && type !== "string") {
                    return {
                        ...field,
                        field: {
                            id: field.field?.id,
                            type: field.reference.type,
                            name: field.field?.name,
                            collectionId: type,
                            userEditable: false,
                        } as ManagedCollectionField,
                    }
                }

                // Default case - just update the type
                return { ...field, field: { ...field.field, type } as ManagedCollectionField }
            })
        )
    }

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        assert(slugFieldId, "Slug field is required")
        onSubmit(
            dataSource,
            fields
                .filter(field => field.field && !disabledFieldIds.has(field.field!.id))
                .filter(field => !field.reference || field.reference.destination !== null),
            slugFieldId
        )
    }

    useLayoutEffect(() => {
        framer.showUI({
            width: 360,
            height: 425,
            minWidth: 360,
            minHeight: 425,
            resizable: true,
        })
    }, [])

    return (
        <main
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                gap: "10px",
                padding: "0 15px 0 15px",
            }}
            className="no-scrollbar"
        >
            <form
                onSubmit={handleSubmit}
                style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    gap: "10px",
                    width: "100%",
                }}
                className="no-scrollbar"
            >
                <hr
                    style={{
                        height: "1px",
                        borderBottom: "1px solid var(--framer-color-divider)",
                        position: "sticky",
                        top: 0,
                    }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "100%" }}>
                        <label
                            htmlFor="slugField"
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                width: "100%",
                                justifyContent: "space-between",
                                gap: "4px",
                                color: "var(--framer-color-text-tertiary)",
                            }}
                        >
                            Slug Field
                            <select
                                name="slugField"
                                style={{ width: "100%" }}
                                value={slugFieldId ?? ""}
                                onChange={e => setSlugFieldId(e.target.value)}
                                required
                            >
                                {slugFields.map(field => {
                                    assert(field.field)
                                    return (
                                        <option key={field.field.id} value={field.field.id}>
                                            {field.field.name}
                                        </option>
                                    )
                                })}
                            </select>
                        </label>
                    </div>
                </div>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 8px 1fr 1fr",
                        gap: "10px",
                        marginBottom: "auto",
                        alignItems: "center",
                        overflow: "hidden",
                        color: "var(--framer-color-text-tertiary)",
                    }}
                >
                    <span
                        style={{
                            gridColumn: "span 2 / span 2",
                        }}
                    >
                        Column
                    </span>
                    <span>Field</span>
                    <span>Type</span>
                    {fields.map((field, i) => {
                        const isUnsupported = !field.field
                        const isMissingReference = !isUnsupported && field.reference?.destination === null
                        const isDisabled = isUnsupported || isMissingReference || disabledFieldIds.has(field.field!.id)

                        const hasFieldNameChanged = field.field?.name !== field.source.name
                        const fieldName = hasFieldNameChanged ? field.field?.name : ""

                        let placeholder = field.source.name
                        if (isMissingReference) {
                            placeholder = "Missing Reference"
                        } else if (isUnsupported) {
                            placeholder = "Unsupported Field"
                        }

                        const selectedType =
                            field.reference && field.field?.type === "string"
                                ? "string"
                                : field.reference?.destination || field.field!.type

                        return (
                            <Fragment key={field.field?.id || i}>
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "row",
                                        alignItems: "center",
                                        opacity: isDisabled ? 0.5 : 1,
                                        gap: "4px",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        disabled={isUnsupported}
                                        checked={!isDisabled}
                                        onChange={() => {
                                            assert(field.field)
                                            handleFieldToggle(field.field.id)
                                        }}
                                    />
                                    <input
                                        type="text"
                                        disabled
                                        value={field.source.name}
                                        style={{
                                            width: "100%",
                                            flexShrink: 1,
                                            pointerEvents: "none",
                                            userSelect: "none",
                                        }}
                                    />
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="16">
                                    <path
                                        d="M 3 11 L 6 8 L 3 5"
                                        fill="transparent"
                                        strokeWidth="1.5"
                                        stroke="#999"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    ></path>
                                </svg>
                                <input
                                    type="text"
                                    style={{
                                        width: "100%",
                                        opacity: isDisabled ? 0.5 : 1,
                                    }}
                                    disabled={isDisabled}
                                    placeholder={placeholder}
                                    value={fieldName || ""}
                                    onChange={e => {
                                        assert(field.field)
                                        if (!e.target.value.trim()) {
                                            handleFieldNameChange(field.field.id, field.source.name)
                                        } else {
                                            handleFieldNameChange(field.field.id, e.target.value)
                                        }
                                    }}
                                />
                                <select
                                    style={{
                                        width: "100%",
                                        opacity: isDisabled ? 0.5 : 1,
                                        textTransform: "capitalize",
                                    }}
                                    disabled={isDisabled}
                                    value={isUnsupported ? "Unsupported Field" : selectedType}
                                    onChange={e => {
                                        assert(field.field)
                                        handleFieldTypeChange(field.field.id, e.target.value as DataSourceFieldType)
                                    }}
                                >
                                    {field.field && (
                                        <>
                                            <option value="string">String</option>
                                            {field.reference ? (
                                                <>
                                                    <hr />
                                                    {COLLECTIONS_SYNC_MAP.get(field.reference.source)?.map(
                                                        ({ id, name }) => (
                                                            <option key={id} value={id}>
                                                                {name}
                                                            </option>
                                                        )
                                                    )}
                                                </>
                                            ) : (
                                                FIELD_MAPPING[field.source.type].map(type => (
                                                    <option key={`${field.source.name}-${type}`} value={type}>
                                                        {TYPE_NAMES[type]}
                                                    </option>
                                                ))
                                            )}
                                        </>
                                    )}
                                </select>
                            </Fragment>
                        )
                    })}
                    {/* {fieldConfig.length > 6 && <div className="scroll-fade"></div>} */}
                </div>
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        position: "sticky",
                        gap: "10px",
                        bottom: 0,
                        left: 0,
                        width: "100%",
                        justifyContent: "space-between",
                        backgroundColor: "var(--framer-color-bg)",
                        paddingBottom: "15px",
                        marginTop: "auto",
                    }}
                >
                    <hr
                        style={{
                            height: "1px",
                            borderBottom: "1px solid var(--framer-color-divider)",
                            marginBottom: "5px",
                        }}
                    />
                    <button className="framer-button-primary" style={{ width: "100%" }}>
                        Import <span style={{ textTransform: "capitalize" }}>{dataSource.id}</span>
                    </button>
                </div>
            </form>
        </main>
    )
}

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

        if (!selectedDataSourceId) return

        setIsLoadingFields(true)

        const dataSource = await getDataSources(selectedDataSourceId)
        if (!dataSource) {
            return framer.notify(`Failed to load collection ${selectedDataSourceId}`, {
                variant: "error",
            })
        }

        setIsLoadingFields(false)
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
            <main
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    padding: "0 15px 15px 15px",
                    width: "100%",
                }}
            >
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
            <main
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    padding: "0 15px 15px 15px",
                }}
            >
                <p>Select a collection to sync with Framer.</p>

                <form
                    style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}
                    onSubmit={showFieldsMapping}
                >
                    <label
                        htmlFor="collection"
                        style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            height: "30px",
                            width: "100%",
                            justifyContent: "space-between",
                            paddingLeft: "15px",
                            color: "var(--framer-color-text-tertiary)",
                        }}
                    >
                        Collection
                        <select
                            id="collection"
                            onChange={e => setSelectedDataSourceId(e.target.value)}
                            value={selectedDataSourceId || ""}
                            style={{ width: "164px", textTransform: "capitalize" }}
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
            existingFields={existingFields}
            savedSlugFieldId={syncSlugFieldId}
            onSubmit={syncCollection}
        />
    )
}

async function syncCollection(collection: DataSource, fields: FieldConfig[], slugFieldId: string) {
    const unsyncedItems = new Set(await activeCollection.getItemIds())

    const items: CollectionItemData[] = []

    const slugField = fields.find(field => field.field?.id === slugFieldId)
    assert(slugField, "Slug field not found")

    for (const item of collection.items) {
        const slugValue = item[slugField.source.name]
        if (typeof slugValue !== "string") {
            framer.notify(`Skipping item ${item.id} because it doesn't have a slug`, {
                variant: "warning",
            })
            continue
        }

        const slug = slugify(slugValue)
        const itemId = generateHashId(slug)
        unsyncedItems.delete(itemId)

        const fieldData: Record<string, unknown> = {}
        for (const [fieldName, value] of Object.entries(item)) {
            const field = fields.find(field => field.source.name === fieldName)

            // Field is in the data but should not be synced
            if (!field?.field) {
                console.warn(`Skipping field ${fieldName} because it may have been ignored`)
                continue
            }

            fieldData[field.field.id] = getFieldValue(field, value)
        }

        items.push({
            id: itemId,
            slug: slug,
            draft: false,
            fieldData,
        })
    }

    await activeCollection.setFields(fields.map(field => field.field!))
    await activeCollection.removeItems(Array.from(unsyncedItems))
    await activeCollection.addItems(items)

    await activeCollection.setPluginData(PLUGIN_COLLECTION_SYNC_REFERENCE_KEY, collection.id)
    await activeCollection.setPluginData(PLUGIN_COLLECTION_SYNC_SLUG_KEY, slugFieldId)

    // TODO: Set each item's plugin data to the item hash.
    // This should allow the plugin to know which items have been synced.

    // const collectionItems = await framer
    //     .getCollection(activeCollection.id)
    //     .then(collection => collection?.getItems() || [])

    // for (const item of collectionItems) {
    //     const sourceItem = collection.items.find(
    //         dataSourceItem => generateHashId(dataSourceItem[slugField.source.name] as string) === item.id
    //     )
    //     if (!sourceItem) continue

    //     const itemHash = Object.entries(sourceItem).reduce((acc, [fieldId, value]) => {
    //         return `${acc}${PLUGIN_DELIMITER}${generateHashId(fieldId)}:${generateHashId(JSON.stringify(value))}`
    //     }, "")

    //     await item.setPluginData(PLUGIN_COLLECTION_ITEM_HASH_KEY, itemHash)
    // }

    // for (const unsyncedItem of unsyncedItems) {
    //     await activeCollection.setPluginData(unsyncedItem, null)
    // }

    await framer.closePlugin(`Synced ${items.length} items from ${collection.id}`, {
        variant: "success",
    })
}

function assert(condition: unknown, ...msg: unknown[]): asserts condition {
    if (condition) return

    const e = Error("Assertion Error" + (msg.length > 0 ? ": " + msg.join(" ") : ""))
    // Hack the stack so the assert call itself disappears. Works in jest and in chrome.
    if (e.stack) {
        try {
            const lines = e.stack.split("\n")
            if (lines[1]?.includes("assert")) {
                lines.splice(1, 1)
                e.stack = lines.join("\n")
            } else if (lines[0]?.includes("assert")) {
                lines.splice(0, 1)
                e.stack = lines.join("\n")
            }
        } catch {
            // nothing
        }
    }
    throw e
}

/**
 * Generates an 8-character unique ID from a text using the djb2 hash function.
 * Converts the 32-bit hash to an unsigned integer and then to a hex string.
 */
function generateHashId(text: string): string {
    let hash = 5381
    for (let i = 0, len = text.length; i < len; i++) {
        hash = (hash * 33) ^ text.charCodeAt(i)
    }
    // Convert to unsigned 32-bit integer
    const unsignedHash = hash >>> 0
    return unsignedHash.toString(16).padStart(8, "0")
}

/**
 * Takes a freeform string and removes all characters except letters, numbers,
 * and parentheses. Also makes it lower case, and separates words by dashes.
 * This makes the value URL safe.
 */
function slugify(value: string): string {
    return value.toLowerCase().replace(nonSlugCharactersRegExp, "-").replace(trimSlugRegExp, "")
}
