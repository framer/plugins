import { framer, type ManagedCollection, type ManagedCollectionFieldInput } from "framer-plugin"
import { fetchSheetWithClient, fetchSpreadsheetInfo, generateHeaderRowHash, getFields, processSheet } from "./sheets"
import { assert, generateUniqueNames, syncMethods } from "./utils"

export const PLUGIN_KEYS = {
    SPREADSHEET_ID: "sheetsPluginSpreadsheetId",
    SHEET_ID: "sheetsPluginSheetId",
    LAST_SYNCED: "sheetsPluginLastSynced",
    IGNORED_COLUMNS: "sheetsPluginIgnoredColumns",
    SHEET_HEADER_ROW_HASH: "sheetsPluginSheetHeaderRowHash",
    SLUG_COLUMN: "sheetsPluginSlugColumn",
} as const

type CellValue = string | number | boolean | null

export interface DataSource {
    id: string
    sheetTitle: string
    sheetRows: CellValue[][]
}

/* Retrieve data and process it into a structured format. */
export async function getDataSource(spreadsheetId: string, sheetTitle: string): Promise<DataSource> {
    return {
        id: spreadsheetId,
        sheetTitle,
        sheetRows: [],
    }
}

export function mergeFieldsWithExistingFields(
    sourceFields: readonly ManagedCollectionFieldInput[],
    existingFields: readonly ManagedCollectionFieldInput[]
): ManagedCollectionFieldInput[] {
    return sourceFields.map(sourceField => {
        const existingField = existingFields.find(existingField => existingField.id === sourceField.id)
        if (existingField) {
            return { ...sourceField, name: existingField.name }
        }
        return sourceField
    })
}

export async function syncCollection(
    collection: ManagedCollection,
    dataSource: DataSource,
    fields: readonly ManagedCollectionFieldInput[],
    ignoredFieldIds: Set<string>,
    slugField: ManagedCollectionFieldInput
) {
    const unsyncedItemIds = new Set(await collection.getItemIds())
    const { id: spreadsheetId, sheetTitle } = dataSource

    const sheet = await fetchSheetWithClient(spreadsheetId, sheetTitle)
    const [headerRow, ...rows] = sheet.values

    const uniqueHeaderRowNames = generateUniqueNames(headerRow)
    const headerRowHash = generateHeaderRowHash(headerRow, Array.from(ignoredFieldIds))

    const { collectionItems, status } = processSheet(rows, {
        uniqueHeaderRowNames,
        unsyncedItemIds,
        fieldTypes: Object.fromEntries(fields.map(field => [field.id, field.type])),
        ignoredFieldColumnIndexes: Array.from(ignoredFieldIds).map(col => uniqueHeaderRowNames.indexOf(col)),
        slugFieldColumnIndex: slugField ? uniqueHeaderRowNames.indexOf(slugField.id) : -1,
    })

    const itemsToDelete = Array.from(unsyncedItemIds)
    await collection.addItems(collectionItems)
    await collection.removeItems(itemsToDelete)
    await collection.setItemOrder(collectionItems.map(collectionItem => collectionItem.id))

    const spreadsheetInfo = await fetchSpreadsheetInfo(spreadsheetId)
    const sheetId = spreadsheetInfo.sheets.find(x => x.properties.title === sheetTitle)?.properties.sheetId
    assert(sheetId !== undefined, "Expected sheet ID to be defined")

    await Promise.all([
        collection.setPluginData(PLUGIN_KEYS.SPREADSHEET_ID, spreadsheetId),
        collection.setPluginData(PLUGIN_KEYS.SHEET_ID, sheetId.toString()),
        collection.setPluginData(PLUGIN_KEYS.IGNORED_COLUMNS, JSON.stringify(Array.from(ignoredFieldIds))),
        collection.setPluginData(PLUGIN_KEYS.SHEET_HEADER_ROW_HASH, headerRowHash),
        collection.setPluginData(PLUGIN_KEYS.SLUG_COLUMN, slugField.id),
        collection.setPluginData(PLUGIN_KEYS.LAST_SYNCED, new Date().toISOString()),
    ])
}

export async function syncExistingCollection(
    collection: ManagedCollection,
    previousSheetId: string | null,
    previousSlugFieldId: string | null,
    previousSpreadsheetId: string | null,
    previousLastSynced: string | null,
    previousIgnoredColumns: string | null,
    previousSheetHeaderRowHash: string | null
): Promise<{ didSync: boolean }> {
    if (!previousSpreadsheetId || !previousSheetId) {
        return { didSync: false }
    }

    if (framer.mode !== "syncManagedCollection" || !previousSlugFieldId) {
        return { didSync: false }
    }

    if (!framer.isAllowedTo(...syncMethods)) {
        return { didSync: false }
    }

    try {
        const dataSource = await getDataSource(previousSpreadsheetId, previousSheetId)
        const existingFields = await collection.getFields()
        const fields = getFields(dataSource, existingFields)

        const slugField = fields.find(field => field.id === previousSlugFieldId)
        if (!slugField) {
            framer.notify(`No field matches the slug field ID “${previousSlugFieldId}”. Sync will not be performed.`, {
                variant: "error",
            })
            return { didSync: false }
        }

        const ignoredFieldIds = new Set(previousIgnoredColumns ? JSON.parse(previousIgnoredColumns) : []) as Set<string>

        await syncCollection(collection, dataSource, existingFields, ignoredFieldIds, slugField)
        return { didSync: true }
    } catch (error) {
        console.error(error)
        framer.notify(`Failed to sync collection “${previousSheetId}”. Check browser console for more details.`, {
            variant: "error",
        })
        return { didSync: false }
    }
}
