import * as v from "valibot"

export const TargetLanguageSchema = v.object({
    id: v.string(),
    name: v.string(),
})

export const ProjectSchema = v.object({
    id: v.optional(v.number()),
    name: v.nullable(v.string()),
    targetLanguages: v.array(TargetLanguageSchema),
})

export const StorageSchema = v.object({
    id: v.optional(v.number()),
    fileName: v.nullable(v.string()),
})

export const ProjectsSchema = v.object({
    data: v.nullable(ProjectSchema),
})

export const StoragesSchema = v.object({
    data: v.nullable(StorageSchema),
})
