import * as v from "valibot"

const AddressSchema = v.object({
    addressLocality: v.optional(v.string()),
    addressRegion: v.optional(v.string()),
    addressCountry: v.optional(v.string()),
})

const CompensationComponentSchema = v.object({
    id: v.optional(v.string()),
    summary: v.optional(v.string()),
    compensationType: v.string(),
    interval: v.string(),
    currencyCode: v.nullable(v.string()),
    minValue: v.nullable(v.number()),
    maxValue: v.nullable(v.number()),
})

const CompensationTiersSchema = v.object({
    id: v.string(),
    tierSummary: v.string(),
    title: v.nullable(v.string()),
    additionalInformation: v.nullable(v.string()),
    components: v.array(CompensationComponentSchema),
})

export const JobAddressSchema = v.object({
    postalAddress: AddressSchema,
})

const SecondaryLocationSchema = v.object({
    location: v.string(),
    address: JobAddressSchema,
})

const CompensationSchema = v.object({
    compensationTierSummary: v.nullable(v.string()),
    scrapeableCompensationSalarySummary: v.nullable(v.string()),
    compensationTiers: v.array(CompensationTiersSchema),
    summaryComponents: v.array(CompensationComponentSchema),
})

// https://developers.ashbyhq.com/docs/public-job-posting-api
export const JobSchema = v.object({
    id: v.string(),
    title: v.string(),
    location: v.string(),
    secondaryLocations: v.array(SecondaryLocationSchema), // allow empty array
    department: v.nullable(v.string()),
    team: v.nullable(v.string()),
    isListed: v.nullable(v.boolean()),
    isRemote: v.nullable(v.boolean()),
    descriptionHtml: v.string(),
    descriptionPlain: v.string(),
    publishedAt: v.string(),
    employmentType: v.string(),
    address: JobAddressSchema,
    jobUrl: v.string(),
    applyUrl: v.string(),
    compensation: CompensationSchema,
    shouldDisplayCompensationOnJobPostings: v.boolean(),
})

export type Job = v.InferOutput<typeof JobSchema>
export type Address = v.InferOutput<typeof AddressSchema>
export type CompensationComponent = v.InferOutput<typeof CompensationComponentSchema>
export type CompensationTiers = v.InferOutput<typeof CompensationTiersSchema>

export function hasOwnProperty<T extends object, Key extends PropertyKey>(
    object: T,
    key: Key
): object is T & Record<Key, unknown> {
    return Object.hasOwn(object, key)
}
