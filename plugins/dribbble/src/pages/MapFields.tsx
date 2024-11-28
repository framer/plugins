import { useState } from "react"
import { Button } from "../components/Button"
import { SHOT_FIELDS } from "../constants"
import { assert, isDefined } from "../utils"
import { getPossibleSlugFields, useLoggingToggle } from "../cms"
import { FieldMapper } from "../components/FieldMapper"
import { PluginContext, SyncShotsMutationOptions } from "../sync"
import { ManagedCollectionField } from "framer-plugin"

interface Props {
    context: PluginContext
    onSubmit: (opts: SyncShotsMutationOptions) => void
    isLoading: boolean
}

const getInitialSlugFieldId = (context: PluginContext, slugFields: ManagedCollectionField[]): string | null => {
    if (context.type === "update" && context.slugFieldId) return context.slugFieldId

    return slugFields.length > 0 ? slugFields[0].id : null
}

export default function MapFields({ context, onSubmit, isLoading }: Props) {
    useLoggingToggle()

    const [includedFieldIds, setIncludedFieldIds] = useState<Set<string>>(
        () => new Set(context.type === "update" ? context.includedFieldIds : SHOT_FIELDS.map(field => field.id))
    )

    const slugFields = getPossibleSlugFields(SHOT_FIELDS).filter(field => includedFieldIds.has(field.id))
    const [slugFieldId, setSlugFieldId] = useState(() => getInitialSlugFieldId(context, slugFields))

    const [collectionFieldConfig] = useState(
        SHOT_FIELDS.map(field => ({
            field,
            originalFieldName: field.name,
        }))
    )
    const [fieldNameOverrides, setFieldNameOverrides] = useState<Record<string, string>>(() =>
        context.type === "update"
            ? Object.fromEntries(context.collectionFields.map(field => [field.id, field.name]))
            : {}
    )

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        assert(slugFieldId)

        const allFields = collectionFieldConfig
            .filter(fieldConfig => fieldConfig.field && includedFieldIds.has(fieldConfig.field.id))
            .map(fieldConfig => fieldConfig.field)
            .filter(isDefined)
            .map(field => {
                // Create copy to prevent showing overriden name temporarily in the UI
                const fieldCopy = { ...field }
                if (fieldNameOverrides[field.id]) {
                    fieldCopy.name = fieldNameOverrides[field.id]
                }

                return field
            })

        onSubmit({ includedFieldIds: Array.from(includedFieldIds), fields: allFields, slugFieldId })
    }

    return (
        <form onSubmit={handleSubmit} className="h-full px-[15px] pb-[15px]">
            <div className="col w-full text-tertiary">
                <label htmlFor="slugField">Slug Field</label>
                <select
                    className="w-full"
                    value={slugFieldId ?? ""}
                    onChange={e => setSlugFieldId(e.target.value)}
                    id="slugField"
                    required
                >
                    {slugFields.map(field => (
                        <option key={field.id} value={field.id}>
                            {field.name}
                        </option>
                    ))}
                </select>
            </div>
            <FieldMapper
                fromLabel="Shot Field"
                toLabel="Collection Field"
                className="pb-[15px] mt-2.5"
                collectionFieldConfig={collectionFieldConfig}
                fieldNameOverrides={fieldNameOverrides}
                isFieldSelected={fieldId => includedFieldIds.has(fieldId)}
                onFieldToggle={fieldId => {
                    setIncludedFieldIds(current => {
                        const nextSet = new Set(current)
                        if (nextSet.has(fieldId)) {
                            nextSet.delete(fieldId)
                        } else {
                            nextSet.add(fieldId)
                        }
                        return nextSet
                    })
                }}
                onFieldNameChange={(fieldId, value) => {
                    setFieldNameOverrides(current => ({
                        ...current,
                        [fieldId]: value,
                    }))
                }}
            />
            <div className="sticky left-0 bottom-0 flex justify-between bg-primary pt-[15px] border-t border-divider items-center max-w-full">
                <Button variant="secondary" className="w-full" isLoading={isLoading}>
                    Import shots
                </Button>
            </div>
        </form>
    )
}
