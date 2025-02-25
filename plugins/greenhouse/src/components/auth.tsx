import { framer } from "framer-plugin"
import Logo from "../assets/splash.png"
import { useEffect, useLayoutEffect, useState, useRef } from "react"
import { initGreenhouse } from "../greenhouse"

/**
 * Authentication component for handling Greenhouse board token
 */
export function Auth({ onSubmit }: { onSubmit: (boardToken: string) => void }) {
    const [boardToken, setBoardToken] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const notificationShown = useRef(false)

    // Configure UI dimensions
    useLayoutEffect(() => {
        framer.showUI({
            width: 320,
            height: 285,
            resizable: false,
        })
    }, [])

    // Pre-fill board token from stored plugin data
    useEffect(() => {
        async function prefill() {
            try {
                const boardToken = await framer.getPluginData("greenhouse")
                if (boardToken) {
                    setBoardToken(boardToken)
                    
                    // Show notification only once
                    if (!notificationShown.current) {
                        framer.notify("Previously used token loaded", {
                            variant: "info",
                            durationMs: 2000
                        })
                        notificationShown.current = true
                    }
                }
            } catch (error) {
                console.error("Error loading saved token:", error)
            }
        }

        prefill()
    }, [])

    return (
        <div className="flex flex-col gap-[15px]">
            {/* Logo/Hero Image */}
            <img
                src={Logo}
                alt="Greenhouse Hero"
                className="object-contain w-full rounded-[10px] h-[180px] bg-greenhouse-green bg-opacity-10"
            />
            
            {/* Token Input */}
            <div className="flex flex-col gap-[10px] text-secondary">
                <div className="row justify-between items-center">
                    <label htmlFor="boardToken" className="ml-[15px]">
                        Board Token
                    </label>
                    <input
                        id="boardToken"
                        type="text"
                        className="w-[134px]"
                        placeholder="Token"
                        value={boardToken}
                        onChange={e => setBoardToken(e.target.value)}
                    />
                </div>
            </div>
            
            {/* Connect Button */}
            <div className="sticky left-0 bottom-0 flex justify-between bg-primary items-center max-w-full">
                <button
                    disabled={isLoading}
                    className="flex justify-center items-center relative py-2 framer-button-secondary w-full"
                    onClick={async () => {
                        setIsLoading(true)
                        try {
                            if (!boardToken || boardToken.trim() === "") {
                                throw new Error("Board token is required")
                            }
                            
                            await initGreenhouse(boardToken)
                            
                            framer.notify("Connected to Greenhouse", {
                                variant: "success",
                                durationMs: 2000
                            })
                            
                            onSubmit(boardToken)
                        } catch (error) {
                            framer.notify(`Connection failed: ${error instanceof Error ? error.message : "Invalid board token"}`, {
                                variant: "error",
                                durationMs: 3000
                            })
                            setIsLoading(false)
                        }
                    }}
                >
                    {isLoading ? "Connecting..." : "Connect"}
                </button>
            </div>
        </div>
    )
}
