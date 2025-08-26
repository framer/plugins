import type { ManagedCollectionFieldInput } from "framer-plugin"
import * as v from "valibot"
import { type CrowdInItem, ProjectsSchema } from "./api-types"

export const API_URL = "https://api.crowdin.com/api/v2"

export interface CrowdInDataSource {
    id: string
    name: string
    /**
     * The fields of the data source.
     *
     * The first field is the ID field.
     * The rest of the fields are the fields of the data source.
     */
    fields: readonly CrowdInField[]
    fetch: (tokenId: string) => Promise<CrowdInItem[]>
}

async function fetchCrowdInData(url: string, tokenId: string): Promise<unknown> {
    try {
        const response = await fetch(url, {
            headers: new Headers({
                Authorization: "Bearer " + tokenId,
            }),
        })
        return await response.json()
    } catch (error) {
        console.error("Error fetching CrowdIn data:", error)
        throw error
    }
}

export type CrowdInField = ManagedCollectionFieldInput &
    (
        | {
              type: Exclude<ManagedCollectionFieldInput["type"], "collectionReference" | "multiCollectionReference">
              /** Used to transform the value of the field. Sometimes the value is inside an object, so we need to extract it. */
              getValue?: (value: unknown) => unknown
              canBeUsedAsSlug?: boolean
          }
        | {
              type: "collectionReference" | "multiCollectionReference"
              getValue?: never
              dataSourceId: string
              supportedCollections?: { id: string; name: string }[]
          }
    )

const ProjectListSchema = v.object({ data: v.array(ProjectsSchema) })
const ProjectListSource = createDataSource(
    {
        name: "projects",
        fetch: async (tokenId: string) => {
            const url = `${API_URL}/projects?limit=500`
            const data = v.safeParse(ProjectListSchema, await fetchCrowdInData(url, tokenId))
            if (!data.success) {
                console.log("Error parsing CrowdIn data:", data.issues)
                throw new Error("Error parsing CrowdIn data")
            }
            return data.output.data
        },
    },
    [
        { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true },
        { id: "id", name: "Id", type: "string", canBeUsedAsSlug: true },
    ]
)

export const dataSources = [ProjectListSource] satisfies CrowdInDataSource[]

function createDataSource(
    {
        name,
        fetch,
    }: {
        name: string
        fetch: (tokenId: string) => Promise<CrowdInItem[]>
    },
    [idField, slugField, ...fields]: [CrowdInField, CrowdInField, ...CrowdInField[]]
): CrowdInDataSource {
    return {
        id: name,
        name,
        fields: [idField, slugField, ...fields],
        fetch,
    }
}

/**
 * Remove CrowdIn-specific keys from the fields. This is used to ensure that the fields are compatible with Framer API.
 *
 * @param fields - The fields to remove the keys from.
 * @returns The fields with the keys removed.
 */
export function removeCrowdInKeys(fields: CrowdInField[]): ManagedCollectionFieldInput[] {
    return fields.map(originalField => {
        const { getValue, ...field } = originalField
        return field
    })
}
