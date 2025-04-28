import { framer } from "framer-plugin"
import Logo from "../assets/splash.png"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { usePluginData } from "../use-plugin-data"
import { PLUGIN_KEYS } from "../data"

export function Auth({ onSubmit }: { onSubmit: (spaceId: string) => void }) {
    const inputRef = useRef<HTMLInputElement>(null)

    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isInitialized, setIsInitialized] = useState<boolean>(false)
    const [spaceId, setSpaceId] = usePluginData(PLUGIN_KEYS.SPACE_ID, {
        onLoad: async spaceId => {
            if (!spaceId) return setIsInitialized(true)

            try {
                const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${spaceId}`)
                if (response.status === 200) {
                    onSubmit?.(spaceId)
                }
            } catch (error) {
                console.error(error)
            } finally {
                setIsInitialized(true)
            }
        },
    })

    useLayoutEffect(() => {
        framer.showUI({
            width: 320,
            height: 300,
            resizable: false,
        })
    }, [])

    useEffect(() => {
        if (spaceId) {
            onSubmit(spaceId)
        }
    }, [spaceId])

    if (!isInitialized) return <div className="framer-spinner" />

    return (
        <main
            // className="flex flex-col gap-[15px]"
            className="framer-hide-scrollbar setup"
        >
            <img
                src={Logo}
                alt="Contentful Hero"
                // className="object-contain w-full rounded-[10px] h-[200px] bg-contentful-orange bg-opacity-10"
            />
            <form
                onSubmit={e => {
                    e.preventDefault()
                }}
            >
                <label
                    htmlFor="spaceId"
                    // className="ml-[15px]"
                >
                    <p>
                        Board Token
                        {error && (
                            <span
                            // className="text-framer-red"
                            >
                                ({error})
                            </span>
                        )}
                    </p>
                    <input
                        ref={inputRef}
                        id="spaceId"
                        type="text"
                        // className="w-[134px]"
                        placeholder="framer"
                        defaultValue={spaceId ?? ""}
                        onChange={() => {
                            setError(null)
                        }}
                    />
                </label>

                <button
                    type="submit"
                    disabled={isLoading}
                    // className="flex justify-center items-center relative py-2 framer-button-secondary w-full"
                    onClick={async () => {
                        const spaceId = inputRef.current?.value

                        if (!spaceId) {
                            setError("Invalid space ID")
                            return
                        }

                        try {
                            setIsLoading(true)

                            const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${spaceId}`)
                            if (response.status === 404) {
                                setError("Invalid")
                                return
                            }

                            setSpaceId(spaceId)
                            onSubmit?.(spaceId)
                            console.log("success")
                        } catch (error) {
                            setError("Invalid")
                            console.error(error)
                        } finally {
                            setIsLoading(false)
                        }

                        // try {
                        //     await initGreenhouse(spaceId)
                        //     onSubmit(spaceId)
                        // } catch (error) {
                        //     setError("Invalid space ID")
                        //     setIsLoading(false)
                        //     throw new Error("Invalid space ID")
                        // }
                    }}
                >
                    {isLoading ? "Connecting..." : "Connect"}
                </button>
            </form>
        </main>
    )
}
