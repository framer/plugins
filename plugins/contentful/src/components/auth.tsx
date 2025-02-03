import { framer } from "framer-plugin"
import Logo from "../assets/splash.png"
import { useLayoutEffect } from "react"

type ContentfulConfig = {
    space: string
    accessToken: string
}

export function Auth({
    contentfulConfig,
    setContentfulConfig,
    isLoading,
    onSubmit,
}: {
    contentfulConfig: ContentfulConfig
    setContentfulConfig: (config: ContentfulConfig | ((config: ContentfulConfig) => ContentfulConfig)) => void
    isLoading: boolean
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {

    useLayoutEffect(() => {
        framer.showUI({
            width: 320,
            height: 345,
            resizable: false,
        })
    }, [])

    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-2.5 text-tertiary">

            <img
                src={Logo}
                alt="Contentful Hero"
                className="object-contain w-full mb-1 rounded-lg h-[200px] bg-contentful-orange bg-opacity-10"
            />


            <div className="grid grid-cols-3 items-center gap-2.5">
                <label htmlFor="spaceId">Space ID</label>
                <input
                    id="spaceId"
                    type="text"
                    className="w-full col-span-2"
                    placeholder="Space ID"
                    value={contentfulConfig.space}
                    onChange={e => setContentfulConfig(prev => ({ ...prev, space: e.target.value }))}
                />
            </div>
            <div className="grid grid-cols-3 items-center gap-2.5">
                <label htmlFor="accessToken">Access Token</label>
                <input
                    id="accessToken"
                    type="text"
                    className="w-full col-span-2"
                    placeholder="Access Token"
                    value={contentfulConfig.accessToken}
                    onChange={e => setContentfulConfig(prev => ({ ...prev, accessToken: e.target.value }))}
                />
            </div>
            <div className="sticky left-0 bottom-0 flex justify-between bg-primary mt-1 items-center max-w-full">
                <button
                    type="submit"
                    disabled={isLoading}
                    className="flex justify-center items-center relative py-2 framer-button-secondary w-full"
                >
                    {isLoading ? "Connecting..." : "Connect"}
                </button>
            </div>
        </form>
    )
}
