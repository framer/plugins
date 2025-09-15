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

export const FileSchema = v.object({
    id: v.number(),
    projectId: v.number(),
    name: v.string(),
    path: v.string(),
    type: v.string(),
    status: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
})

export const CreateFileResponseSchema = v.object({
    data: FileSchema,
})

export const FileResponseSchema = v.object({
    data: v.array(v.object({ data: FileSchema })),
    pagination: v.object({
        offset: v.number(),
        limit: v.number(),
    }),
})

export const LanguageSchema = v.object({
    id: v.string(),
    name: v.string(),
    editorCode: v.string(),
    twoLettersCode: v.string(),
    threeLettersCode: v.string(),
    locale: v.string(),
    androidCode: v.string(),
    osxCode: v.string(),
    osxLocale: v.string(),
    pluralCategoryNames: v.array(v.string()),
    pluralRules: v.string(),
    pluralExamples: v.array(v.string()),
    textDirection: v.string(),
    dialectOf: v.nullable(v.string()),
})

export const LanguagesResponseSchema = v.object({
    data: v.array(v.object({ data: LanguageSchema })),
    pagination: v.object({
        offset: v.number(),
        limit: v.number(),
    }),
})
