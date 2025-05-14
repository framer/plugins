import { framer } from "framer-plugin"
import Logo from "../assets/Asset.png"
import { useLayoutEffect, useRef, useState } from "react"
import { usePluginData } from "../hooks/use-plugin-data"
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
            height: 285,
            resizable: false,
        })
    }, [])

    if (!isInitialized) return <div className="framer-spinner" />

    return (
        <main className="framer-hide-scrollbar setup">
            <img src={Logo} alt="Greenhouse Hero" />
            <form
                onSubmit={e => {
                    e.preventDefault()
                }}
            >
                <label>
                    <p>
                        Board Token{" "}
                        {error && (
                            <span
                                style={{
                                    color: "#FF3366",
                                }}
                            >
                                ({error})
                            </span>
                        )}
                    </p>
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="token"
                        defaultValue={spaceId ?? ""}
                        onChange={() => {
                            setError(null)
                        }}
                    />
                </label>

                <button
                    type="submit"
                    disabled={isLoading}
                    onClick={async () => {
                        const spaceId = inputRef.current?.value

                        if (!spaceId) {
                            setError("Invalid")
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
                    }}
                >
                    {isLoading ? "Connecting..." : "Connect"}
                </button>
            </form>
        </main>
    )
}
