import Logo from "../assets/splash.png"
import { framer } from "framer-plugin"
import { useEffect, useLayoutEffect, useState } from "react"
import { CONTENT_TYPES, Department, getAllContentTypes, Job, Office, Degree, Discipline, School, Section } from "../greenhouse"

/**
 * Component for selecting Greenhouse content types to import
 */
export function ContentTypePicker({ onSubmit }: { onSubmit: (contentTypeId: string) => void }) {
    // State for managing content type selection
    const [contentTypeId, setContentTypeId] = useState<string | null>(null)
    const [contentTypes, setContentTypes] = useState<{ 
        id: string; 
        entries: Job[] | Department[] | Office[] | Degree[] | Discipline[] | School[] | Section[] 
    }[]>([])

    // Fetch available content types from Greenhouse
    useEffect(() => {
        const fetchContentTypes = async () => {
            try {
                // Get all content types with minimal data
                const contentTypes = await getAllContentTypes(false)

                // Filter content types that have entries
                const contentTypesWithEntries = Object.entries(contentTypes)
                    .map(([id, entries]) => ({
                        id,
                        entries,
                    }))
                    .filter(({ entries }) => entries?.length > 0)

                setContentTypes(contentTypesWithEntries)
                
                // Only show warning if no content types found
                if (contentTypesWithEntries.length === 0) {
                    framer.notify("No content types with data found. Try a different board token.", {
                        variant: "warning",
                        durationMs: 4000
                    })
                }
            } catch (error) {
                framer.notify(`Failed to fetch content types: ${error instanceof Error ? error.message : String(error)}`, {
                    variant: "error",
                    durationMs: 5000
                })
            }
        }

        fetchContentTypes()
    }, [])

    // Configure UI dimensions
    useLayoutEffect(() => {
        framer.showUI({
            width: 320,
            height: 285,
            resizable: false,
        })
    }, [])

    return (
        <div className="flex flex-col gap-[15px] text-greenhouse-green">
            {/* Logo/Hero Image */}
            <img
                src={Logo}
                alt="Contentful Hero"
                className="object-contain w-full rounded-[10px] h-[180px] bg-greenhouse-green bg-opacity-10"
            />
            
            {/* Content Type Selector */}
            <div className="row justify-between items-center text-secondary">
                <label htmlFor="contentType" className="ml-[15px]">
                    Content Type
                </label>
                <select
                    id="contentType"
                    className="w-[134px]"
                    onChange={e => setContentTypeId(e.target.value)}
                    disabled={contentTypes.length === 0}
                    defaultValue=""
                >
                    <option value="" disabled>
                        {contentTypes.length === 0 ? "Loading..." : "Select..."}
                    </option>

                    {contentTypes.map(({ id }) => (
                        <option key={id} value={id}>
                            {CONTENT_TYPES.find(ct => ct.id === id)?.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Next Button */}
            <div className="sticky left-0 bottom-0 flex justify-between bg-primary items-center max-w-full">
                <button
                    type="submit"
                    disabled={!contentTypeId || contentTypes.length === 0}
                    className="flex justify-center items-center relative py-2 framer-button-secondary w-full"
                    onClick={() => {
                        if (contentTypeId) {
                            onSubmit(contentTypeId)
                        }
                    }}
                >
                    Next
                </button>
            </div>
        </div>
    )
}
