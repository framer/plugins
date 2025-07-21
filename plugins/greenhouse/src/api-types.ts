import * as v from "valibot"

const DepartmentLeafSchema = v.object({
    id: v.number(),
    name: v.string(),
})

const OfficeLeafSchema = v.object({
    id: v.number(),
    name: v.string(),
    location: v.nullable(v.string()),
})

const JobLeafSchema = v.object({
    id: v.number(),
    internal_job_id: v.number(),
    title: v.string(),
    updated_at: v.string(),
    requisition_id: v.nullable(v.string()),
    absolute_url: v.string(),
    location: v.object({ name: v.string() }),
})

export const DepartmentSchema = v.object({
    ...DepartmentLeafSchema.entries,
    jobs: v.array(JobLeafSchema),
})

export type Department = v.InferOutput<typeof DepartmentSchema>

export const OfficeSchema = v.object({
    ...OfficeLeafSchema.entries,
    departments: v.array(DepartmentLeafSchema),
})

export type Office = v.InferOutput<typeof OfficeSchema>

export const JobSchema = v.object({
    ...JobLeafSchema.entries,
    content: v.string(),
    departments: v.array(DepartmentLeafSchema),
    offices: v.array(OfficeLeafSchema),
})

export type Job = v.InferOutput<typeof JobSchema>

export const EducationSchema = v.object({
    id: v.number(),
    text: v.string(),
})

export type Education = v.InferOutput<typeof EducationSchema>

export const SectionSchema = v.object({
    id: v.number(),
    name: v.string(),
    jobs: v.array(JobLeafSchema),
})

export type Section = v.InferOutput<typeof SectionSchema>

export type GreenhouseItem = Job | Department | Office | Education | Section

export function isGreenhouseItemField<T extends GreenhouseItem>(field: unknown, itemType: T): field is keyof T {
    if (typeof field !== "string" || field === "") return false
    return Object.prototype.hasOwnProperty.call(itemType, field)
}
