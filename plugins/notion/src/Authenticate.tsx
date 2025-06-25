import { framer } from "framer-plugin"
import { useEffect, useRef, useState } from "react"
import loginIllustration from "./assets/notion-doodle.png"
import { Button } from "./components/Button"
import { authorize, getOauthURL, getPluginContext, type PluginContext } from "./notion"
import { generateRandomId } from "./utils"

function useIsDocumentVisibile() {
    const [isVisible, setIsVisible] = useState(document.visibilityState === "visible")

    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsVisible(document.visibilityState === "visible")
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange)
        }
    }, [])

    return isVisible
}

interface AuthenticationProps {
    onAuthenticated: (context: PluginContext) => void
    context: PluginContext
}

export function Authentication({ onAuthenticated, context }: AuthenticationProps) {
    const [isLoading, setIsLoading] = useState(false)
    const isDocumentVisible = useIsDocumentVisibile()
    const notifiedForContextRef = useRef<PluginContext | null>(null)

    useEffect(() => {
        // after authentication the user may not have returned to Framer yet.
        // So the toast is only displayed upon document being visible
        if (!isDocumentVisible) return
        // Only notify once per context
        if (notifiedForContextRef.current === context) return
        if (context.type !== "error") return

        notifiedForContextRef.current = context
        framer.notify(context.message, { variant: "error" })
    }, [context, isDocumentVisible])

    const handleAuth = () => {
        setIsLoading(true)
        const writeKey = generateRandomId()

        // It is important to call `window.open` directly in the event handler
        // So that Safari does not block any popups.
        window.open(getOauthURL(writeKey), "_blank")

        authorize({ readKey: generateRandomId(), writeKey })
            .then(getPluginContext)
            .then(onAuthenticated)
            .finally(() => {
                setIsLoading(false)
            })
    }
    return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-[20px] pb-4 overflo">
            <img
                src={loginIllustration}
                className="max-w-100% rounded-md flex-shrink-0 select-none pointer-events-none"
            />

            <div className="flex flex-col items-center gap-2 flex-1 justify-center w-full">
                {isLoading ? (
                    <span className="text-center max-w-[80%] block text-secondary">
                        Complete the authentication and return to this page.
                    </span>
                ) : (
                    <ol className="list-inside list-decimal w-full text-secondary gap-[4px] text-md flex flex-col flex-1">
                        <li className="marker:primary">
                            <span className="text-tertiary pl-[6px]">Log in to your Notion account</span>
                        </li>
                        <li className="marker:primary">
                            <span className="text-tertiary pl-[6px]">Pick the database you want to import</span>
                        </li>
                        <li className="marker:primary">
                            <span className="text-tertiary pl-[6px]">Map the database fields to the CMS</span>
                        </li>
                    </ol>
                )}
            </div>

            <Button onClick={handleAuth} isLoading={isLoading} disabled={isLoading}>
                Log In
            </Button>
        </div>
    )
}
