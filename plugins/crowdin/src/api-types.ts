import * as v from "valibot"

export const ProjectSchema = v.object({
    id: v.optional(v.number()),
    name: v.nullable(v.string()),
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
export type Projects = v.InferOutput<typeof ProjectsSchema>

export type CrowdInItem = Projects

export function hasOwnProperty<T extends object, Key extends PropertyKey>(
    object: T,
    key: Key
): object is T & Record<Key, unknown> {
    return Object.hasOwn(object, key)
}
