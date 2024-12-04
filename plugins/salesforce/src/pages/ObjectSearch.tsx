import { useState } from "react"
import { useLocation } from "wouter"
import { ScrollFadeContainer } from "../components/ScrollFadeContainer"
import { SearchIcon, IconChevron } from "../components/Icons"
import { SFObject, useObjectsQuery } from "@/api"
import { CenteredSpinner } from "@/components/CenteredSpinner"
import auth from "@/auth"
import { useSearchParams } from "@/hooks/useSearchParams"
import { PluginError } from "@/PluginError"
import { framer } from "framer-plugin"

const searchObjects = (objects: SFObject[], query: string) => {
    if (!query.trim() || !objects) return objects || []

    const searchTerm = query.toLowerCase().trim()

    const exactMatches: SFObject[] = []
    const startsWithMatches: SFObject[] = []
    const containsMatches: SFObject[] = []

    objects.forEach(object => {
        const name = object.name.toLowerCase()
        const label = object.label.toLowerCase()

        // Exact matches (highest priority)
        if (name === searchTerm || label === searchTerm) {
            exactMatches.push(object)
        }
        // Starts with matches (medium priority)
        else if (name.startsWith(searchTerm) || label.startsWith(searchTerm)) {
            startsWithMatches.push(object)
        }
        // Contains matches (lowest priority)
        else if (name.includes(searchTerm) || label.includes(searchTerm)) {
            containsMatches.push(object)
        }
    })

    return [...exactMatches, ...startsWithMatches, ...containsMatches]
}

export default function ObjectSearch() {
    const [, navigate] = useLocation()
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const { data: objects, isLoading } = useObjectsQuery()

    const params = useSearchParams()
    const redirect = params.get("redirect")
    const requiredFields = params.get("requiredFields")?.split(",") || []

    const handleNavigateToObject = (object: SFObject) => {
        navigate(`${redirect}?objectName=${object.name}&objectLabel=${object.label}`, {
            state: { title: object.label },
        })
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Pressing enter will go ahead with the first object shown
        if (e.key === "Enter" && filteredObjects?.length > 0) {
            e.preventDefault()
            handleNavigateToObject(filteredObjects[0])
        }
    }

    if (!redirect) {
        throw new PluginError("Param Error", "Expected 'redirect' query param")
    }

    if (isLoading) return <CenteredSpinner />

    if (!objects) return null

    const allowedObjects = objects.sobjects.filter(object =>
        requiredFields.every(field => object[field as keyof SFObject] === true)
    )
    const filteredObjects = searchObjects(allowedObjects, searchQuery)

    return (
        <div className="flex flex-col gap-0 p-[15px]">
            <div className="relative flex items-center pb-[15px]">
                <SearchIcon className="absolute left-[10px] text-gray-400" />
                <input
                    type="text"
                    placeholder="Search objects..."
                    className="w-full !pl-[30px]"
                    onChange={e => setSearchQuery(e.target.value)}
                    value={searchQuery}
                    onKeyDown={handleKeyDown}
                />
            </div>
            <ScrollFadeContainer className="col pb-[15px]" height={framer.mode === "canvas" ? 240 : 278}>
                {filteredObjects.length > 0 ? (
                    filteredObjects.map((object, index) => (
                        <button
                            key={object.name}
                            className="tile h-[30px] flex items-center justify-between rounded-lg pl-[15px]"
                            onMouseEnter={() => setHoveredIndex(index)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            onClick={() => handleNavigateToObject(object)}
                        >
                            <p
                                className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[190px] text-primary font-medium"
                                title={`${object.label} (${object.name})`}
                            >
                                {object.label} ({object.name})
                            </p>
                            {hoveredIndex === index && <IconChevron />}
                        </button>
                    ))
                ) : (
                    <div className="col items-center my-auto">
                        <p className="text-primary">No Results</p>
                        <p className="max-w-[200px] text-tertiary text-center">
                            Try using different keywords and search again
                        </p>
                    </div>
                )}
            </ScrollFadeContainer>
            <div className="col-lg sticky top-0 left-0">
                <hr />
                <button
                    className="framer-button-primary"
                    onClick={() =>
                        window.open(
                            `${auth.tokens.getOrThrow().instanceUrl}/lightning/setup/ObjectManager/home`,
                            "_blank"
                        )
                    }
                >
                    View Objects
                </button>
            </div>
        </div>
    )
}
