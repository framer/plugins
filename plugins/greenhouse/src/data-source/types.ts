import type { ManagedCollectionFieldInput } from "framer-plugin"

export interface GreenhouseDataSource {
    id: string
    name: string
    fields: GreenhouseField[]
    idField: string
    slugField: string
    apiEndpoint: string
    itemsKey: string
}

export type GreenhouseField = ManagedCollectionFieldInput &
    (
        | {
              type: Exclude<ManagedCollectionFieldInput["type"], "collectionReference" | "multiCollectionReference">
              getValue?: <T>(value: T) => unknown
              canBeUsedAsSlug?: boolean
          }
        | {
              type: "collectionReference" | "multiCollectionReference"
              getCollectionId?: () => string
              supportedCollections?: { id: string; name: string }[]
              getValue?: <T>(value: T) => string[]
          }
    )

/**
 * Remove Greenhouse-specific keys from the fields. This is used to ensure that the fields are compatible with Framer API.
 *
 * @param fields - The fields to remove the keys from.
 * @returns The fields with the keys removed.
 */
export function removeGreenhouseKeys(fields: GreenhouseField[]): ManagedCollectionFieldInput[] {
    return fields.map(field => {
        if (field.type === "collectionReference" || field.type === "multiCollectionReference") {
            delete field.getCollectionId
        }
        delete field.getValue
        return field
    })
}
