import { CheckboxTextfield } from "@/components/CheckboxTextField"
import { IconChevron } from "@/components/Icons"
import { ScrollFadeContainer } from "@/components/ScrollFadeContainer"
import { HUBSPOT_BLOG_FIELDS } from "@/constants"
import { assert, capitalize, isDefined } from "@/utils"
import { framer, ManagedCollectionField } from "framer-plugin"
import classNames from "classnames"
import { Fragment, useEffect, useState } from "react"
import { Button } from "@/components/Button"
import { syncBlogs } from "@/blog"
import { useLoggingToggle } from "@/cms"
import { PageProps } from "@/router"

interface ManagedCollectionFieldConfig {
    field: ManagedCollectionField | null
    originalFieldName: string
}

export default function Blog({ blogPluginContext }: PageProps) {
    useLoggingToggle()
    const [isSyncing, setIsSyncing] = useState(false)
    const [includedFieldIds, setIncludedFieldIds] = useState<Set<string>>(new Set())
    const [collectionFieldConfig, setCollectionFieldConfig] = useState<ManagedCollectionFieldConfig[]>([])
    const [fieldNameOverrides, setFieldNameOverrides] = useState<Record<string, string>>({})

    useEffect(() => {
        if (!blogPluginContext) return

        const colFieldConfig: ManagedCollectionFieldConfig[] = HUBSPOT_BLOG_FIELDS.map(blogField => ({
            name: blogField.name,
            originalFieldName: blogField.name,
            field: blogField,
        }))
        const nameOverrides =
            blogPluginContext.type === "update"
                ? Object.fromEntries(blogPluginContext.collectionFields.map(field => [field.id, field.name]))
                : {}
        const includedFields = new Set(
            blogPluginContext.type === "update"
                ? blogPluginContext.includedFieldIds
                : HUBSPOT_BLOG_FIELDS.map(field => field.id)
        )

        setIncludedFieldIds(includedFields)
        setCollectionFieldConfig(colFieldConfig)
        setFieldNameOverrides(nameOverrides)
    }, [blogPluginContext])

    const handleFieldToggle = (fieldId: string) => {
        setIncludedFieldIds(current => {
            const nextSet = new Set(current)
            if (nextSet.has(fieldId)) {
                nextSet.delete(fieldId)
            } else {
                nextSet.add(fieldId)
            }
            return nextSet
        })
    }

    const handleFieldNameChange = (fieldName: string, value: string) => {
        setFieldNameOverrides(current => ({
            ...current,
            [fieldName]: value,
        }))
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        setIsSyncing(true)

        const allFields = collectionFieldConfig
            .filter(fieldConfig => fieldConfig.field && includedFieldIds.has(fieldConfig.field.id))
            .map(fieldConfig => fieldConfig.field)
            .filter(isDefined)
            .map(field => {
                if (fieldNameOverrides[field.id]) {
                    field.name = fieldNameOverrides[field.id]
                }

                return field
            })

        syncBlogs({ includedFieldIds: Array.from(includedFieldIds), fields: allFields }).then(() =>
            framer.closePlugin("Synchronization successful")
        )
    }

    return (
        <form onSubmit={handleSubmit} className="col-lg flex-1 text-tertiary w-[340px] p-[15px]">
            <ScrollFadeContainer className="grid grid-cols items-center grid-cols-fieldPicker gap-2.5" height={349}>
                <span className="col-span-2">Blog Field</span>
                <span>Collection Field</span>
                {collectionFieldConfig.map((fieldConfig, i) => {
                    const isUnsupported = !fieldConfig.field

                    return (
                        <Fragment key={i}>
                            <CheckboxTextfield
                                value={capitalize(fieldConfig.originalFieldName)}
                                disabled={!fieldConfig.field}
                                checked={!!fieldConfig.field && includedFieldIds.has(fieldConfig.field.id)}
                                onChange={() => {
                                    assert(fieldConfig.field)

                                    handleFieldToggle(fieldConfig.field.id)
                                }}
                            />
                            <IconChevron className={isUnsupported ? "opacity-50" : ""} />
                            <input
                                type="text"
                                className={classNames("w-full", { "opacity-50": isUnsupported })}
                                disabled={!fieldConfig.field || !includedFieldIds.has(fieldConfig.field.id)}
                                placeholder={fieldConfig.originalFieldName}
                                value={
                                    !fieldConfig.field
                                        ? "Unsupported Field"
                                        : (fieldNameOverrides[fieldConfig.field.id] ?? "")
                                }
                                onChange={e => {
                                    assert(fieldConfig.field)

                                    handleFieldNameChange(fieldConfig.field.id, e.target.value)
                                }}
                            />
                        </Fragment>
                    )
                })}
            </ScrollFadeContainer>
            <div className="sticky left-0 bottom-0 flex justify-between bg-primary pt-[15px] border-t border-divider border-opacity-20 items-center max-w-full">
                <Button variant="secondary" className="w-full" isLoading={isSyncing}>
                    Import Blog
                </Button>
            </div>
        </form>
    )
}
