import {
    type FieldDataInput,
    framer,
    type ManagedCollection,
    type ManagedCollectionFieldInput,
    type ManagedCollectionItemInput,
    type ProtectedMethod,
} from "framer-plugin"
import pLimit from "p-limit"

import * as v from "valibot"
import { hasOwnProperty } from "./api-types"
import { dataSources, type PrCoField, type PrcoDataSource } from "./dataSources"
import { assertNever, isCollectionReference } from "./utils"

// This is to process multiple items at a time.
const CONCURRENCY_LIMIT = 5

export const slugFieldIdPluginKey = "slugFieldId"
export const pressRoomIdPluginKey = "pressRoomId"
export const dataSourceIdPluginKey = "dataSourceId"

function replaceSupportedCollections(
    dataSource: PrcoDataSource,
    fieldToCollectionsMap: Map<string, ManagedCollection[]>
): PrcoDataSource {
    const fields = dataSource.fields.map(field => {
        if (!isCollectionReference(field)) return field

        const matchingCollections = fieldToCollectionsMap.get(field.id)

        return {
            ...field,
            collectionId: matchingCollections?.[0]?.id ?? "",
            supportedCollections:
                matchingCollections?.map(collection => ({
                    id: collection.id,
                    name: collection.name,
                })) ?? [],
        }
    })

    return { ...dataSource, fields }
}

export async function getDataSource(pressRoomId: string, dataSourceId: string): Promise<PrcoDataSource> {
    if (!pressRoomId) {
        throw new Error("No Press Room Id found.")
    }
    const dataSource = dataSources.find(option => option.id === dataSourceId)
    if (!dataSource) {
        throw new Error(`No data source found for id "${dataSourceId}".`)
    }

    const fieldToCollectionsMap = new Map<string, ManagedCollection[]>()
    const itemCollections: ManagedCollection[] = []

    const managedCollections = await framer.getManagedCollections()
    for (const collection of managedCollections) {
        const collectionToken = await collection.getPluginData(pressRoomIdPluginKey)
        if (collectionToken !== pressRoomId) {
            continue
        }

        itemCollections.push(collection)
    }

    if (itemCollections.length > 0) {
        for (const field of dataSource.fields) {
            if (!isCollectionReference(field)) continue

            const matchingCollections: ManagedCollection[] = []
            for (const collection of itemCollections) {
                const collectionDataSourceId = await collection.getPluginData(dataSourceIdPluginKey)
                if (collectionDataSourceId !== field.dataSourceId) continue

                matchingCollections.push(collection)
            }

            fieldToCollectionsMap.set(field.id, matchingCollections)
        }
    }

    return replaceSupportedCollections(dataSource, fieldToCollectionsMap)
}

export function mergeFieldsWithExistingFields(
    sourceFields: readonly PrCoField[],
    existingFields: readonly ManagedCollectionFieldInput[]
): PrCoField[] {
    const existingFieldsMap = new Map(existingFields.map(field => [field.id, field]))

    return sourceFields.map(sourceField => {
        const existingField = existingFieldsMap.get(sourceField.id)
        if (existingField) {
            return { ...sourceField, name: existingField.name }
        }
        return sourceField
    })
}

const StringifiableSchema = v.union([v.string(), v.number(), v.boolean()])
const ArrayOfIdsSchema = v.array(v.union([v.string(), v.number()]))

async function getItems(
    dataSource: PrcoDataSource,
    fieldsToSync: readonly PrCoField[],
    { pressRoomId, slugFieldId }: { pressRoomId: string; slugFieldId: string }
): Promise<ManagedCollectionItemInput[]> {
    const items: ManagedCollectionItemInput[] = []

    const dataItems = await dataSource.fetch(pressRoomId)

    const itemIdBySlug = new Map<string, string>()
    const idField = fieldsToSync[0]
    if (!idField) {
        throw new Error("No ID field found in data source.")
    }

    for (const item of dataItems) {
        if (!hasOwnProperty(item, slugFieldId)) {
            throw new Error(`No slug field found in data source.`)
        }

        const id = String(item.id)
        const slug = String(item[slugFieldId]).trim()

        if (!itemIdBySlug.has(slug)) {
            itemIdBySlug.set(slug, id)
            continue
        }

        const uniqueSlug = `${slug} ${id}`
        itemIdBySlug.set(uniqueSlug, id)
    }

    const slugByItemId = new Map<string, string>()
    for (const [slug, itemId] of itemIdBySlug.entries()) {
        slugByItemId.set(itemId, slug)
    }

    const fieldLookup = new Map<string, PrCoField[]>()
    for (const field of dataSource.fields.filter(field =>
        fieldsToSync.some(fieldToSync => fieldToSync.id === field.id)
    )) {
        const key = field.key ?? field.id
        if (!fieldLookup.has(key)) {
            fieldLookup.set(key, [])
        }
        const existingFields = fieldLookup.get(key)
        if (existingFields) {
            existingFields.push(field)
        }
    }

    const limit = pLimit(CONCURRENCY_LIMIT)

    const promises = dataItems.map(item =>
        limit(async () => {
            const id = String(item.id)
            const slug = slugByItemId.get(id)
            if (!slug) {
                return
            }

            const fieldData: FieldDataInput = {}
            for (const [fieldName, rawValue] of Object.entries(item)) {
                const isFieldIgnored = !fieldsToSync.find(field => (field.key ?? field.id) === fieldName)
                const fields = fieldLookup.get(fieldName) ?? []

                if (fields.length === 0 || isFieldIgnored) {
                    continue
                }

                for (const field of fields) {
                    const value = field.getValue ? field.getValue(rawValue) : (rawValue as unknown)

                    switch (field.type) {
                        case "string":
                            fieldData[field.id] = {
                                value: v.is(StringifiableSchema, value) ? String(value) : "",
                                type: "string",
                            }
                            break
                        case "number":
                            fieldData[field.id] = { value: Number(value), type: "number" }
                            break
                        case "boolean":
                            fieldData[field.id] = { value: Boolean(value), type: "boolean" }
                            break
                        case "formattedText":
                            fieldData[field.id] = {
                                value: v.is(StringifiableSchema, value) ? String(value) : "",
                                type: "formattedText",
                            }
                            break
                        case "color":
                        case "date":
                        case "link": {
                            if (!value) break

                            fieldData[field.id] = {
                                value: v.is(StringifiableSchema, value) ? String(value) : null,
                                type: field.type,
                            }
                            break
                        }
                        case "multiCollectionReference": {
                            const ids = []

                            if (v.is(ArrayOfIdsSchema, value)) {
                                ids.push(...value.map(item => String(item)))
                            }

                            fieldData[field.id] = {
                                value: ids,
                                type: "multiCollectionReference",
                            }
                            break
                        }
                        case "collectionReference": {
                            if (v.is(v.union([v.string(), v.number()]), value)) {
                                fieldData[field.id] = {
                                    value: String(value),
                                    type: "collectionReference",
                                }
                            }
                            break
                        }
                        case "image":
                        case "file": {
                            if (!value) break

                            const url = v.is(StringifiableSchema, value) ? String(value) : ""

                            let validUrl: string | null = null

                            // prevent breaking if image is not valid
                            try {
                                if (field.type === "image") {
                                    const uploadedImage = await framer.uploadImage({ image: url })
                                    validUrl = uploadedImage.url
                                } else {
                                    const uploadedFile = await framer.uploadFile({ file: url })
                                    validUrl = uploadedFile.url
                                }
                            } catch (error) {
                                console.error(error)
                            }

                            fieldData[field.id] = {
                                type: field.type,
                                value: validUrl,
                            }
                            break
                        }
                        case "array": {
                            const parsedValue = v.parse(v.array(v.string()), value)
                            const fieldId = v.parse(v.string(), field.id)

                            const fields = v.parse(v.array(v.object({ id: v.string() })), field.fields)
                            const galleryFieldId = v.parse(v.string(), fields[0]?.id)

                            // prevent breaking if some images are not valid
                            let validUrls: string[] = []

                            try {
                                const uploadedImages = await framer.uploadImages(
                                    parsedValue.filter(url => url).map((url: string) => ({ image: url }))
                                )
                                validUrls = uploadedImages.map(image => image.url)
                            } catch (error) {
                                console.error(error)
                            }

                            fieldData[fieldId] = {
                                type: "array",
                                value: validUrls.map((url: string) => ({
                                    fieldData: {
                                        [galleryFieldId]: {
                                            type: "image",
                                            value: url,
                                        },
                                    },
                                })),
                            }

                            break
                        }
                        case "enum": {
                            const parsedValue = v.parse(v.string(), value)

                            if (field.cases.find(item => item.id === parsedValue)?.id) {
                                fieldData[field.id] = {
                                    type: "enum",
                                    value: parsedValue,
                                }
                            } else {
                                console.error(`Invalid enum value for: ${field.name}: ${parsedValue}`)
                            }

                            break
                        }
                        default:
                            assertNever(field)
                    }
                }
            }

            items.push({
                id,
                slug,
                draft: false,
                fieldData,
            })
        })
    )

    await Promise.all(promises)

    return items
}

export async function syncCollection(
    pressRoomId: string,
    collection: ManagedCollection,
    dataSource: PrcoDataSource,
    fields: readonly PrCoField[],
    slugField: ManagedCollectionFieldInput
): Promise<void> {
    const [existingItemsIds, items] = await Promise.all([
        collection.getItemIds(),
        getItems(dataSource, fields, {
            pressRoomId: pressRoomId,
            slugFieldId: slugField.id,
        }),
    ])
    const itemIds = new Set(items.map(item => item.id))
    const unsyncedItemsIds = existingItemsIds.filter(existingItemId => !itemIds.has(existingItemId))

    await Promise.all([
        collection.removeItems(unsyncedItemsIds),
        collection.addItems(items),
        collection.setPluginData(pressRoomIdPluginKey, pressRoomId),
        collection.setPluginData(dataSourceIdPluginKey, dataSource.id),
        collection.setPluginData(slugFieldIdPluginKey, slugField.id),
    ])
}

export const syncMethods = [
    "ManagedCollection.removeItems",
    "ManagedCollection.addItems",
    "ManagedCollection.setPluginData",
] as const satisfies ProtectedMethod[]

export async function syncExistingCollection(
    collection: ManagedCollection,
    previousDataSourceId: string | null,
    previousSlugFieldId: string | null,
    previousPressRoomId: string | null
): Promise<{ didSync: boolean }> {
    if (!previousDataSourceId || !previousPressRoomId) {
        return { didSync: false }
    }

    if (framer.mode !== "syncManagedCollection" || !previousSlugFieldId) {
        return { didSync: false }
    }

    if (!framer.isAllowedTo(...syncMethods)) {
        void framer.closePlugin("You are not allowed to sync this collection.", {
            variant: "error",
        })
        return { didSync: false }
    }

    try {
        const [dataSource, existingFields] = await Promise.all([
            getDataSource(previousPressRoomId, previousDataSourceId),
            collection.getFields(),
        ])
        const mappedFields = dataSource.fields.filter(field =>
            existingFields.some(existingField => existingField.id === field.id)
        )

        const slugField = dataSource.fields.find(field => field.id === previousSlugFieldId)
        if (!slugField) {
            framer.notify(`No field matches the slug field ID “${previousSlugFieldId}”. Sync will not be performed.`, {
                variant: "error",
            })
            return { didSync: false }
        }

        await syncCollection(previousPressRoomId, collection, dataSource, mappedFields, slugField)
        return { didSync: true }
    } catch (error) {
        console.error(error)
        framer.notify(`Failed to sync collection “${previousDataSourceId}”. Check browser console for more details.`, {
            variant: "error",
        })
        return { didSync: false }
    }
}
