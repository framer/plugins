import { framer } from "framer-plugin"
import { useEffect, useRef, useState } from "react"
import { PLUGIN_KEYS } from "../data"

export function Auth({ onAuth }: { onAuth: (boardToken: string) => void }) {
    const [isLoading, setIsLoading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const [defaultBoardToken, setDefaultBoardToken] = useState<string | null>(null)

    useEffect(() => {
        async function getBoardToken() {
            const defaultBoardToken = await framer.getPluginData(PLUGIN_KEYS.SPACE_ID)
            if (defaultBoardToken) {
                setDefaultBoardToken(defaultBoardToken)
            }
        }
        getBoardToken()
    }, [])

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const boardToken = inputRef.current?.value

        if (!boardToken) return

        try {
            setIsLoading(true)

            const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${boardToken}`)
            if (response.status === 200) {
                onAuth?.(boardToken)
                console.log("success")
            } else {
                throw new Error("Invalid board token")
            }
        } catch (error) {
            console.error(error)
            framer.notify(`Board ${boardToken} not found`, { variant: "error" })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="framer-hide-scrollbar setup">
            <img src="/Asset.png" alt="Greenhouse Hero" onDragStart={e => e.preventDefault()} />
            <form onSubmit={handleSubmit}>
                <label>
                    <p>Board Token</p>
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Token"
                        required
                        defaultValue={defaultBoardToken ?? ""}
                    />
                </label>

                <button type="submit" disabled={isLoading}>
                    {isLoading ? "Connecting..." : "Connect"}
                </button>
            </form>
        </div>
    )
}
