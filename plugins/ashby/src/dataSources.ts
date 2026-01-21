import type { ManagedCollectionFieldInput } from "framer-plugin"
import * as v from "valibot"
import { type DataItem, type Job, type JobAddress, JobAddressSchema, JobSchema, type Location } from "./api-types"

export interface AshbyDataSource<T extends DataItem = DataItem> {
    id: string
    name: string
    /**
     * The fields of the data source.
     *
     * The first field is the ID field.
     * The rest of the fields are the fields of the data source.
     */
    fields: readonly AshbyField[]
    fetch: (jobBoardName: string) => Promise<T[]>
    /** Extracts the ID from a data entry. Required when other data sources reference this one. */
    getItemId?: (entry: unknown) => string | null
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
              dataSourceId: string
              supportedCollections?: { id: string; name: string }[]
          }
    )

const JobApiResponseSchema = v.object({ jobs: v.array(JobSchema) })

const locationsDataSourceName = "Locations"

function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
}

/** Extracts the location ID from a location entry. Used both for creating Location items and for references. */
function getLocationId(entry: unknown): string | null {
    if (typeof entry === "string") {
        return slugify(entry)
    }
    if (typeof entry === "object" && entry !== null && "location" in entry) {
        const location = (entry as { location: unknown }).location
        if (typeof location === "string") {
            return slugify(location)
        }
    }
    return null
}

function extractLocation(locationName: string, address: JobAddress | null): Location {
    const postalAddress = address?.postalAddress
    const parts = [
        postalAddress?.addressLocality?.trim(),
        postalAddress?.addressRegion?.trim(),
        postalAddress?.addressCountry?.trim(),
    ].filter(Boolean)

    return {
        id: getLocationId(locationName) ?? "",
        name: locationName,
        locality: postalAddress?.addressLocality?.trim() ?? "",
        region: postalAddress?.addressRegion?.trim() ?? "",
        country: postalAddress?.addressCountry?.trim() ?? "",
        fullAddress: [...new Set(parts)].join(", "),
    }
}

const locationsDataSource: AshbyDataSource<Location> = {
    id: locationsDataSourceName,
    name: locationsDataSourceName,
    getItemId: getLocationId,
    fields: [
        { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true },
        { id: "locality", name: "Locality", type: "string" },
        { id: "region", name: "Region", type: "string" },
        { id: "country", name: "Country", type: "string" },
        { id: "fullAddress", name: "Full Address", type: "string" },
    ],
    fetch: async (jobBoardName: string): Promise<Location[]> => {
        const url = `https://api.ashbyhq.com/posting-api/job-board/${jobBoardName}?includeCompensation=true`
        const data = v.safeParse(JobApiResponseSchema, await fetchAshbyData(url))

        if (!data.success) {
            console.log("Error parsing Ashby data:", data.issues)
            throw new Error("Error parsing Ashby data")
        }

        const locationMap = new Map<string, Location>()

        for (const job of data.output.jobs) {
            // Primary location
            const primary = extractLocation(job.location, job.address)
            if (primary.id && !locationMap.has(primary.id)) {
                locationMap.set(primary.id, primary)
            }

            // Secondary locations
            for (const secondary of job.secondaryLocations) {
                const loc = extractLocation(secondary.location, secondary.address)
                if (loc.id && !locationMap.has(loc.id)) {
                    locationMap.set(loc.id, loc)
                }
            }
        }

        return Array.from(locationMap.values())
    },
}

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
                if (!value) return ""

                const address = v.parse(JobAddressSchema, value).postalAddress

                const parts = [
                    address.addressLocality?.trim(),
                    address.addressRegion?.trim(),
                    address.addressCountry?.trim(),
                ].filter(Boolean)

                // use Set to remove duplicates (e.g. "San Francisco, CA, CA")
                return parts.length > 0 ? [...new Set(parts)].join(", ") : ""
            },
        },
        {
            id: "region",
            key: "address",
            name: "Region",
            type: "string",
            getValue: (value: unknown) => {
                if (!value) return ""

                const address = v.parse(JobAddressSchema, value).postalAddress

                return address.addressRegion?.trim() ?? ""
            },
        },
        {
            id: "country",
            key: "address",
            name: "Country",
            type: "string",
            getValue: (value: unknown) => {
                if (!value) return ""

                const address = v.parse(JobAddressSchema, value).postalAddress

                return address.addressCountry?.trim() ?? ""
            },
        },
        {
            id: "locality",
            key: "address",
            name: "Locality",
            type: "string",
            getValue: (value: unknown) => {
                if (!value) return ""

                const address = v.parse(JobAddressSchema, value).postalAddress

                return address.addressLocality?.trim() ?? ""
            },
        },
        {
            id: "locationRef",
            key: "location",
            name: "Location Reference",
            type: "collectionReference",
            dataSourceId: locationsDataSourceName,
            collectionId: "",
        },
        {
            id: "secondaryLocations",
            name: "Secondary Locations",
            type: "multiCollectionReference",
            dataSourceId: locationsDataSourceName,
            collectionId: "",
        },
    ]
)

export const dataSources: AshbyDataSource[] = [jobsDataSource, locationsDataSource]

function createDataSource<T extends DataItem>(
    {
        name,
        fetch,
        getItemId,
    }: {
        name: string
        fetch: (jobBoardName: string) => Promise<T[]>
        getItemId?: (entry: unknown) => string | null
    },
    [idField, slugField, ...fields]: [AshbyField, AshbyField, ...AshbyField[]]
): AshbyDataSource<T> {
    return {
        id: name,
        name,
        getItemId,
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
        if (originalField.type === "collectionReference" || originalField.type === "multiCollectionReference") {
            return originalField
        }
        const { getValue, ...field } = originalField
        return field
    })
}
