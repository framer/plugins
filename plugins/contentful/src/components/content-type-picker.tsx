import { ContentType } from "contentful"
import Logo from "../assets/splash.png"
import { framer } from "framer-plugin"
import { useLayoutEffect } from "react"

export function ContentTypePicker({
    onSubmit,
    contentTypes,
    isLoading,
}: {
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
    contentTypes: ContentType[]
    isLoading: boolean
}) {
    useLayoutEffect(() => {
        framer.showUI({
            width: 320,
            height: 305,
            resizable: false,
        })
    }, [])

    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-[15px] text-secondary">
            <img
                src={Logo}
                alt="Contentful Hero"
                className="object-contain w-full rounded-[10px] h-[200px] bg-contentful-orange bg-opacity-10"
            />
            <div className="row justify-between items-center items-center">
                <label htmlFor="contentType" className="ml-[15px]">Content Type</label>
                <select id="contentType" className="w-[134px]">
                    <option disabled>Select a content type</option>
                    {contentTypes.map(contentType => (
                        <option key={contentType.sys.id} value={contentType.sys.id}>
                            {contentType.name}
                        </option>
                    ))}
                </select>
            </div>
            <div className="sticky left-0 bottom-0 flex justify-between bg-primary items-center max-w-full">
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
