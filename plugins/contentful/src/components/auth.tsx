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
    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-2.5 text-tertiary">
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
            <div className="sticky left-0 bottom-0 flex justify-between bg-primary py-4 mt-1.5 border-t border-divider border-opacity-20 items-center max-w-full">
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
