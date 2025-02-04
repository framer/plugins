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
        <>
            <form onSubmit={onSubmit} className="flex flex-col gap-[15px]">
                <img
                    src={Logo}
                    alt="Contentful Hero"
                    className="object-contain w-full rounded-[10px] h-[200px] bg-contentful-orange bg-opacity-10"

                />
                <div className="flex flex-col gap-[10px] text-secondary">
                    <div className="row justify-between items-center items-center">
                        <label htmlFor="spaceId" className="ml-[15px]">Space ID</label>
                        <input
                            id="spaceId"
                            type="text"
                            className="w-[134px]"
                            placeholder="Space ID"
                            value={contentfulConfig.space}
                            onChange={e => setContentfulConfig(prev => ({ ...prev, space: e.target.value }))}
                        />
                    </div>
                    <div className="row justify-between items-center items-center">
                        <label htmlFor="accessToken" className="ml-[15px]">Access Token</label>
                        <input
                            id="accessToken"
                            type="text"
                            className="w-[134px]"
                            placeholder="Access Token"
                            value={contentfulConfig.accessToken}
                            onChange={e => setContentfulConfig(prev => ({ ...prev, accessToken: e.target.value }))}
                        />
                    </div>
                </div>
                <div className="sticky left-0 bottom-0 flex justify-between bg-primary items-center max-w-full">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="flex justify-center items-center relative py-2 framer-button-secondary w-full"
                    >
                        {isLoading ? "Connecting..." : "Connect"}
                    </button>
                </div>
            </form>
        </>
    )
}
