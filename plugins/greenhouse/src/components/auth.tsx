import { useRef, useState } from "react"

export function Auth({ onAuth }: { onAuth: (boardToken: string) => void }) {
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [boardToken, setBoardToken] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const onSubmit = async (boardToken: string) => {
        try {
            setIsLoading(true)
            const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${boardToken}`)
            if (response.status === 200) {
                onAuth(boardToken)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="framer-hide-scrollbar setup">
            <img src="/Asset.png" alt="Greenhouse Hero" onDragStart={e => e.preventDefault()} />
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
                        defaultValue={boardToken ?? ""}
                        onChange={() => {
                            setError(null)
                        }}
                    />
                </label>

                <button
                    type="submit"
                    disabled={isLoading}
                    onClick={async () => {
                        const boardToken = inputRef.current?.value

                        if (!boardToken) {
                            setError("Invalid")
                            return
                        }

                        try {
                            setIsLoading(true)

                            const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${boardToken}`)
                            if (response.status === 404) {
                                setError("Invalid")
                                return
                            }

                            setBoardToken(boardToken)
                            onSubmit?.(boardToken)
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
        </div>
    )
}
