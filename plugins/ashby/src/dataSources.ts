import type { ManagedCollectionFieldInput } from "framer-plugin"
import { type AshbyItem, validateJobs } from "./api-types"

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
    apiPath: string
    fetch: (boardToken: string) => Promise<AshbyItem[]>
}

async function fetchAshbyData(url: string, itemsKey: string): Promise<unknown[]> {
    try {
        const response = await fetch(url)
        const data = await response.json()
        const items = data[itemsKey]

        // console.log(items)

        // await new Promise(resolve => setTimeout(resolve, 1000000))

        return items
    } catch (error) {
        console.error("Error fetching Ashby data:", error)
        throw error
    }
}

export type AshbyField = ManagedCollectionFieldInput &
    (
        | {
              type: Exclude<ManagedCollectionFieldInput["type"], "collectionReference" | "multiCollectionReference">
              /** Used to transform the value of the field. Sometimes the value is inside an object, so we need to extract it. */
              getValue?: <T>(value: T) => unknown
              canBeUsedAsSlug?: boolean
          }
        | {
              type: "collectionReference" | "multiCollectionReference"
              getValue?: never
              dataSourceId: string
              supportedCollections?: { id: string; name: string }[]
          }
    )

const jobsDataSource = createDataSource(
    {
        name: "Jobs",
        apiPath: "job-board",
        fetch: async (boardToken: string) => {
            const url = `https://api.ashbyhq.com/posting-api/job-board/${boardToken}?includeCompensation=true`
            const items = await fetchAshbyData(url, "jobs")
            validateJobs(items)
            return items
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

                // const parts = []

                // // Add string fields if they exist and aren't empty
                // if (
                //     "compensationTierSummary" in value &&
                //     typeof value.compensationTierSummary === "string" &&
                //     value.compensationTierSummary.trim()
                // ) {
                //     parts.push(value.compensationTierSummary.trim())
                // }
                // if (
                //     "scrapeableCompensationSalarySummary" in value &&
                //     typeof value.scrapeableCompensationSalarySummary === "string" &&
                //     value.scrapeableCompensationSalarySummary.trim()
                // ) {
                //     parts.push(value.scrapeableCompensationSalarySummary.trim())
                // }

                // // Add compensation tiers
                // if ("compensationTiers" in value && Array.isArray(value.compensationTiers)) {
                //     const tierSummaries = value.compensationTiers
                //         .map(tier => (typeof tier.tierSummary === "string" ? tier.tierSummary.trim() : ""))
                //         .filter(Boolean)
                //     if (tierSummaries.length) parts.push(tierSummaries.join(", "))
                // }

                // // Add summary components
                // if ("summaryComponents" in value && Array.isArray(value.summaryComponents)) {
                //     const componentSummaries = value.summaryComponents.map(component => {
                //         const range =
                //             component.minValue === component.maxValue
                //                 ? `${component.currencyCode}${component.minValue.toLocaleString()}`
                //                 : `${component.currencyCode}${component.minValue.toLocaleString()}-${component.maxValue.toLocaleString()}`
                //         return `${component.compensationType} (${component.interval}): ${range}`
                //     })
                //     parts.push(componentSummaries.join(", "))
                // }

                // return parts.length ? parts.join(" | ") : null
            },
        },
        {
            id: "address",
            name: "Address",
            type: "string",
            getValue: value => {
                if (typeof value === "object" && value !== null && "postalAddress" in value) {
                    const address = (
                        value as {
                            postalAddress: { addressLocality: string; addressRegion: string; addressCountry: string }
                        }
                    ).postalAddress
                    const parts = [
                        address?.addressLocality?.trim(),
                        address?.addressRegion?.trim(),
                        address?.addressCountry?.trim(),
                    ].filter(Boolean)

                    return parts.length > 0 ? parts.join(", ") : null
                }

                return null
            },
        },
    ]
)

export const dataSources = [jobsDataSource] satisfies AshbyDataSource[]

function createDataSource(
    {
        name,
        apiPath,
        fetch,
    }: {
        name: string
        apiPath: string
        fetch: (boardToken: string) => Promise<AshbyItem[]>
    },
    [idField, slugField, ...fields]: [AshbyField, AshbyField, ...AshbyField[]]
): AshbyDataSource {
    return {
        id: name,
        name,
        apiPath,
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
        const field = { ...originalField }
        delete field.getValue
        return field
    })
}
