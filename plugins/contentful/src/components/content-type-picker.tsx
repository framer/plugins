import { ContentType } from "contentful"

export function ContentTypePicker({
    onSubmit,
    contentTypes,
    isLoading,
}: {
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
    contentTypes: ContentType[]
    isLoading: boolean
}) {
    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-2.5 text-tertiary">
            <div className="grid grid-cols-3 items-center gap-2.5">
                <label htmlFor="contentType">Content Type</label>
                <select
                    id="contentType"
                    className="w-full col-span-2"
                    onChange={e => {
                        console.log("contentType", e.target.value)
                    }}
                >
                    <option disabled>Select a content type</option>
                    {contentTypes.map(contentType => (
                        <option key={contentType.sys.id} value={contentType.sys.id}>
                            {contentType.name}
                        </option>
                    ))}
                </select>
            </div>
            <div className="sticky left-0 bottom-0 flex justify-between bg-primary py-4 mt-1.5 border-t border-divider border-opacity-20 items-center max-w-full">
                <button
                    type="submit"
                    disabled={isLoading}
                    className="flex justify-center items-center relative py-2 framer-button-secondary w-full"
                >
                    {isLoading ? "Loading..." : "Next"}
                </button>
            </div>
        </form>
    )
}
