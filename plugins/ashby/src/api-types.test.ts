import * as v from "valibot"
import { describe, expect, it } from "vitest"
import { JobSchema, SecondaryLocationSchema } from "./api-types"

const baseJob = {
    id: "job-1",
    title: "Engineer",
    location: "New York City",
    secondaryLocations: [],
    department: "Engineering",
    team: null,
    isListed: true,
    isRemote: false,
    descriptionHtml: "<p>Hello</p>",
    descriptionPlain: "Hello",
    publishedAt: "2024-01-01T00:00:00.000Z",
    employmentType: "FullTime",
    address: {
        postalAddress: {
            addressLocality: "New York City",
            addressRegion: "New York",
            addressCountry: "United States",
        },
    },
    jobUrl: "https://jobs.ashbyhq.com/example/job-1",
    applyUrl: "https://jobs.ashbyhq.com/example/job-1/application",
    compensation: {
        compensationTierSummary: null,
        scrapeableCompensationSalarySummary: null,
        compensationTiers: [],
        summaryComponents: [],
    },
    shouldDisplayCompensationOnJobPostings: false,
}

describe("SecondaryLocationSchema", () => {
    it("allows null address for secondary locations", () => {
        const result = v.safeParse(SecondaryLocationSchema, {
            location: "Remote",
            address: null,
        })

        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.output).toEqual({ location: "Remote", address: null })
        }
    })

    it("parses secondary locations with an address", () => {
        const result = v.safeParse(SecondaryLocationSchema, {
            location: "London",
            address: {
                postalAddress: {
                    addressLocality: "London",
                    addressCountry: "United Kingdom",
                },
            },
        })

        expect(result.success).toBe(true)
    })
})

describe("JobSchema", () => {
    it("parses jobs with null secondary location addresses", () => {
        const result = v.safeParse(JobSchema, {
            ...baseJob,
            secondaryLocations: [{ location: "Remote", address: null }],
        })

        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.output.secondaryLocations[0]).toEqual({
                location: "Remote",
                address: null,
            })
        }
    })

    it("parses jobs with a null primary address", () => {
        const result = v.safeParse(JobSchema, {
            ...baseJob,
            address: null,
        })

        expect(result.success).toBe(true)
    })
})
