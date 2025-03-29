import { useInView } from "react-intersection-observer"
import { CONTENT_TYPES } from "../greenhouse"
import { CheckboxTextfield } from "./checkbox-text-field"
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react"
import cx from "classnames"
import { CollectionField, framer } from "framer-plugin"
import { useCollections } from "../hooks/use-collections"
import { useStore } from "../store"

// Define possible field types
type FieldType = "string" | "date" | "link" | "formattedText" | "multiCollectionReference" | "collectionReference"

/**
 * Component for mapping Greenhouse fields to Framer collection fields
 */
export function Fields({
    contentTypeId,
    onSubmit,
}: {
    contentTypeId: string
    onSubmit: (slugFieldId: string, fields: CollectionField[]) => Promise<void>
}) {
    // Get content type definition
    const contentType = CONTENT_TYPES.find(type => type.id === contentTypeId)

    // State for mapped fields with their types and settings
    const [mappedContentType, setMappedContentType] = useState<{
        id: string
        name: string
        type: string
        defaultType: string
        isDisabled: boolean
        isMissingReference: boolean
        collectionId?: string
        userEditable: boolean
    }[]>([])

    // Get available collections for reference fields
    const collections = useCollections()

    // Filter out disabled and invalid reference fields
    const filteredMappedContentType = mappedContentType?.filter(
        ({ isDisabled, isMissingReference }) => !isDisabled && !isMissingReference
    )

    // Extract field definitions for Framer collection
    const fields = filteredMappedContentType?.map(field => ({
        id: field.id,
        name: field.name,
        type: field.type as CollectionField["type"],
        userEditable: field.userEditable,
        collectionId: field.collectionId,
    })) as CollectionField[]

    // Get fields that can be used as slugs (string type)
    const slugableFields = filteredMappedContentType?.filter(({ type }) => type === "string")

    // Load fields from collection
    useEffect(() => {
        if (collections.length === 0) return

        const fetch = async () => {            
            try {
                const collection = await framer.getActiveManagedCollection()
                const fields = await collection.getFields()

                // Map content type fields to collection fields
                setMappedContentType(
                    contentType?.fields?.map(field => {
                        const collectionId = collections.find(
                            collection => 'contentTypeId' in field && collection.contentTypeId === field.contentTypeId
                        )?.id

                        const existingField = fields.find(f => f.id === field.id)

                        return {
                            ...field,
                            name: existingField?.name ?? field.name,
                            type: existingField?.type ?? field.type,
                            defaultType: field.type,
                            isDisabled: !existingField && fields.length !== 0,
                            isMissingReference:
                                (field.type as FieldType === "multiCollectionReference" || field.type as FieldType === "collectionReference") &&
                                !collectionId,
                            collectionId,
                            userEditable: false,
                        }
                    }) ?? []
                )
                
                framer.notify("Fields loaded successfully", {
                    variant: "success",
                    durationMs: 2000
                })
            } catch (error) {
                console.error("Error accessing collection:", error)
                
                framer.notify(`Failed to access collection: ${error instanceof Error ? error.message : String(error)}`, {
                    variant: "error",
                    durationMs: 3000
                })
            }
        }

        fetch()
    }, [contentType, collections])

    // Local state
    const [slugFieldId, setSlugFieldId] = useState<string | null>(useStore.getState().slugFieldId)
    const slugSelectRef = useRef<HTMLSelectElement>(null)
    const [isLoading, setIsLoading] = useState(false)
    
    // Intersection observer for scroll indicator
    const { ref: scrollRef, inView: isAtBottom } = useInView({ threshold: 1 })

    // Configure UI dimensions
    useLayoutEffect(() => {
        if (mappedContentType.length === 0) return

        framer.showUI({
            width: 340,
            height: Math.max(345, Math.min(425, (mappedContentType?.length ?? 0) * 100)),
            resizable: false,
        })
    }, [mappedContentType])

    // Don't render until we have content
    if (mappedContentType.length === 0) return null

    return (
        <div className="col gap-[10px] flex-1 text-tertiary">
            {/* Header divider */}
            <div className="h-px border-b border-divider mb-[5px] sticky top-0" />
            
            {/* Slug Field Selector */}
            <div className="flex flex-col gap-[10px] mb-[15px] w-full">
                <label htmlFor="collectionName">Slug Field</label>
                <select
                    ref={slugSelectRef}
                    className="w-full"
                    defaultValue={slugFieldId ?? ""}
                    onChange={e => setSlugFieldId(e.target.value)}
                    disabled={!slugableFields?.length}
                >
                    {slugableFields?.map(({ id, name }) => (
                        <option key={id} value={id}>
                            {name}
                        </option>
                    ))}
                </select>
                {slugableFields?.length === 0 && (
                    <span className="text-xs text-framer-red">A String field is required as slug.</span>
                )}
            </div>

            {/* Field Mappings */}
            <div className="grid grid-cols items-center grid-cols-fieldPicker gap-[10px] mb-auto overflow-hidden">
                <span className="col-span-2">Column</span>
                <span>Field</span>
                
                {/* Field List */}
                {mappedContentType
                    ?.sort((a, b) => (a.isMissingReference ? 1 : b.isMissingReference ? -1 : 0))
                    ?.map(({ id, name, isDisabled, isMissingReference }, index) => (
                        <Fragment key={id}>
                            {/* Checkbox */}
                            <CheckboxTextfield
                                disabled={Boolean(isMissingReference)}
                                value={contentType?.fields?.find(field => field.id === id)?.name ?? ""}
                                checked={!isDisabled && !isMissingReference}
                                onChange={() => {
                                    setMappedContentType(prev => {
                                        if (!prev) return prev
                                        const newMappedContentType = structuredClone(prev)
                                        newMappedContentType[index].isDisabled = !newMappedContentType[index].isDisabled
                                        return newMappedContentType
                                    })
                                }}
                            />
                            
                            {/* Arrow Icon */}
                            <div className="flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="16">
                                    <path
                                        d="M 3 11 L 6 8 L 3 5"
                                        fill="transparent"
                                        strokeWidth="1.5"
                                        stroke="#999"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </div>
                            
                            {/* Field Name Input */}
                            <input
                                type="text"
                                className={cx("w-full", {
                                    "opacity-50": isDisabled || isMissingReference,
                                })}
                                placeholder={name}
                                value={isMissingReference ? "Missing reference" : name}
                                disabled={isDisabled || isMissingReference}
                                onChange={e => {
                                    setMappedContentType(prev => {
                                        if (!prev) return prev
                                        const newMappedContentType = structuredClone(prev)
                                        newMappedContentType[index].name = e.target.value
                                        return newMappedContentType
                                    })
                                }}
                            />
                        </Fragment>
                    ))}
                
                {/* Scroll indicator */}
                {mappedContentType && mappedContentType?.length > 6 && !isAtBottom && (
                    <div className="scroll-fade"></div>
                )}
                <div ref={scrollRef} className="h-0 w-0"></div>
            </div>
            
            {/* Import Button */}
            <div className="sticky left-0 bottom-0 flex justify-between bg-primary py-[15px] border-t border-divider border-opacity-20 items-center max-w-full">
                <button
                    type="button"
                    disabled={
                        isLoading ||
                        !mappedContentType.length ||
                        !slugableFields.length ||
                        !fields.length
                    }
                    className="w-full"
                    onClick={async () => {
                        setIsLoading(true)
                        
                        // Single notification for the entire import process
                        const notification = framer.notify("Importing data from Greenhouse...", {
                            variant: "info",
                            durationMs: 30000
                        })
                        
                        try {
                            // Validate input
                            if (!slugSelectRef.current?.value) {
                                notification.close()
                                throw new Error("Please select a slug field")
                            }
                            
                            if (fields.length === 0) {
                                notification.close()
                                throw new Error("No fields selected for mapping")
                            }
                            
                            // Process field mappings and submit
                            await onSubmit(slugSelectRef.current.value, fields)
                            
                            // Close notification and show success
                            notification.close()
                            framer.notify("Import successful!", {
                                variant: "success",
                                durationMs: 3000
                            })
                        } catch (error) {
                            // We only log errors here since this is a UI component
                            // and not a service layer
                            console.error("Error submitting field mappings:", error)
                            
                            // Close notification and show error
                            notification.close()
                            framer.notify(`Import failed: ${error instanceof Error ? error.message : String(error)}`, {
                                variant: "error",
                                durationMs: 5000
                            })
                        } finally {
                            setIsLoading(false)
                        }
                    }}
                >
                    {isLoading ? "Importing..." : `Import from ${contentType?.name}`}
                </button>
            </div>
        </div>
    )
}
