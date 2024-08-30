import { useEffect, useRef, useState } from "react"
import { framer } from "framer-plugin"
import { getPluginContext, PluginContext } from "../sheets"
import auth from "../auth"

import { Button } from "../components/Button"
import { Hero } from "../components/Hero"

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

export function Authenticate({ onAuthenticated, context }: AuthenticationProps) {
    const [isLoading, setIsLoading] = useState(false)
    const notifiedForContextRef = useRef<PluginContext | null>(null)
    const pollInterval = useRef<number | ReturnType<typeof setInterval>>()
    const isDocumentVisible = useIsDocumentVisibile()

    useEffect(() => {
        // User may not have returned to Framer yet, so only notify when they do
        if (!isDocumentVisible) return
        // Only notify once per context
        if (notifiedForContextRef.current === context) return
        if (context.type !== "error") return

        notifiedForContextRef.current = context
        framer.notify(context.message, { variant: "error" })
    }, [context, isDocumentVisible])

    const pollForTokens = (readKey: string) => {
        if (pollInterval.current) {
            clearInterval(pollInterval.current)
        }

        return new Promise(
            resolve => (pollInterval.current = setInterval(() => auth.fetchTokens(readKey).then(resolve), 2500))
        )
    }

    const login = async () => {
        setIsLoading(true)

        try {
            // Retrieve the auth URL and a set of read and write keys
            const authorization = await auth.authorize()

            // Open up the Google authorization window
            window.open(authorization.url)

            // Poll the auth server and wait for tokens
            await pollForTokens(authorization.readKey)

            onAuthenticated(await getPluginContext())
        } catch (e) {
            framer.notify(e instanceof Error ? e.message : "An unknown error ocurred.", {
                variant: "error",
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="col-lg">
            <Hero />
            <ol className="list-decimal list-inside space-y-2.5 *:text-tertiary marker:text-secondary">
                <li>Log in to your Google account</li>
                <li>Ensure your sheet has a header row</li>
                <li>Map the column fields to the CMS</li>
            </ol>
            <Button variant="secondary" onClick={login} isPending={isLoading} className="w-full">
                Log In
            </Button>
        </div>
    )
}
