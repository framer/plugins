import type { ManagedCollectionFieldInput } from "framer-plugin"
import * as v from "valibot"
import { type Job, JobAddressSchema, JobSchema } from "./api-types"

export interface AshbyDataSource {
    id: string
    name: string
    /**
     * The fields of the data source.
     *
     * The first field is the ID field.
     * The rest of the fields are the fields of the data source.
     */
    fields: readonly AshbyField[]
    fetch: (jobBoardName: string) => Promise<Job[]>
}

async function fetchAshbyData(url: string): Promise<unknown> {
    try {
        const response = await fetch(url)
        const data = (await response.json()) as unknown

        return data
    } catch (error) {
        console.error("Error fetching Ashby data:", error)
        throw error
    }
}

export type AshbyField = ManagedCollectionFieldInput &
    (
        | {
              key?: string
              type: Exclude<ManagedCollectionFieldInput["type"], "collectionReference" | "multiCollectionReference">
              /** Used to transform the value of the field. Sometimes the value is inside an object, so we need to extract it. */
              getValue?: (value: unknown) => unknown
              canBeUsedAsSlug?: boolean
          }
        | {
              key?: string
              type: "collectionReference" | "multiCollectionReference"
              getValue?: never
              dataSourceId: string
              supportedCollections?: { id: string; name: string }[]
          }
    )

const JobApiResponseSchema = v.object({ jobs: v.array(JobSchema) })

const jobsDataSource = createDataSource(
    {
        name: "Jobs",
        fetch: async (jobBoardName: string): Promise<Job[]> => {
            const url = `https://api.ashbyhq.com/posting-api/job-board/${jobBoardName}?includeCompensation=true`

            // use safeParse to log the issues
            const data = v.safeParse(JobApiResponseSchema, await fetchAshbyData(url))

            if (!data.success) {
                console.log("Error parsing Ashby data:", data.issues)
                throw new Error("Error parsing Ashby data")
            }

            return data.output.jobs
        },
    },
    [
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "title", name: "Title", type: "string", canBeUsedAsSlug: true },
        { id: "descriptionHtml", name: "Description", type: "formattedText" },
        { id: "department", name: "Department", type: "string" },
        { id: "team", name: "Team", type: "string" },
        { id: "location", name: "Location", type: "string" },
        { id: "employmentType", name: "Employment Type", type: "string" },
        { id: "isRemote", name: "Remote", type: "boolean" },
        { id: "publishedAt", name: "Published At", type: "date" },
        { id: "jobUrl", name: "Job URL", type: "link" },
        { id: "applyUrl", name: "Apply URL", type: "link" },
        {
            id: "shouldDisplayCompensationOnJobPostings",
            name: "Should Display Compensation",
            type: "boolean",
        },
        {
            id: "compensation",
            name: "Compensation",
            type: "string",
            getValue: value => {
                if (typeof value !== "object" || value === null) return null

                if ("scrapeableCompensationSalarySummary" in value) {
                    return value.scrapeableCompensationSalarySummary
                }

                if ("compensationTierSummary" in value) {
                    return value.compensationTierSummary
                }

                return null
            },
        },
        {
            id: "address",
            name: "Address",
            type: "string",
            getValue: (value: unknown) => {
                const address = v.parse(JobAddressSchema, value).postalAddress

                const parts = [
                    address.addressLocality?.trim(),
                    address.addressRegion?.trim(),
                    address.addressCountry?.trim(),
                ].filter(Boolean)

                // use Set to remove duplicates (e.g. "San Francisco, CA, CA")
                return parts.length > 0 ? [...new Set(parts)].join(", ") : null
            },
        },
        {
            id: "region",
            key: "address",
            name: "Region",
            type: "string",
            getValue: (value: unknown) => {
                const address = v.parse(JobAddressSchema, value).postalAddress

                return address.addressRegion?.trim()
            },
        },
        {
            id: "country",
            key: "address",
            name: "Country",
            type: "string",
            getValue: (value: unknown) => {
                const address = v.parse(JobAddressSchema, value).postalAddress

                return address.addressCountry?.trim()
            },
        },
        {
            id: "locality",
            key: "address",
            name: "Locality",
            type: "string",
            getValue: (value: unknown) => {
                const address = v.parse(JobAddressSchema, value).postalAddress

                return address.addressLocality?.trim()
            },
        },
    ]
)

export const dataSources = [jobsDataSource] satisfies AshbyDataSource[]

function createDataSource(
    {
        name,
        fetch,
    }: {
        name: string
        fetch: (jobBoardName: string) => Promise<Job[]>
    },
    [idField, slugField, ...fields]: [AshbyField, AshbyField, ...AshbyField[]]
): AshbyDataSource {
    return {
        id: name,
        name,
        fields: [idField, slugField, ...fields],
        fetch,
    }
}

/**
 * Remove Ashby-specific keys from the fields. This is used to ensure that the fields are compatible with Framer API.
 *
 * @param fields - The fields to remove the keys from.
 * @returns The fields with the keys removed.
 */
export function removeAshbyKeys(fields: AshbyField[]): ManagedCollectionFieldInput[] {
    return fields.map(originalField => {
        const { getValue, ...field } = originalField

        return field
    })
}
