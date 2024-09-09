import { useEffect, useRef, useState } from "react"
import { framer } from "framer-plugin"
import { useLocation } from "wouter"
import auth from "../auth"
import { Button } from "../components/Button"
import { Logo } from "../components/Logo"

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

export function AuthenticatePage() {
    const [, navigate] = useLocation()
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState("")
    const [hasSeenError, setHasSeenError] = useState(false)
    const pollInterval = useRef<number | ReturnType<typeof setInterval>>()
    const isDocumentVisible = useIsDocumentVisibile()

    useEffect(() => {
        // User may still be on the authorization page, so show when they're back
        if (isDocumentVisible && errorMessage && !hasSeenError) {
            framer.notify(errorMessage, { variant: "error" })
            setHasSeenError(true)
        }
    }, [isDocumentVisible, errorMessage, hasSeenError])

    const pollForTokens = (readKey: string) => {
        if (pollInterval.current) {
            clearInterval(pollInterval.current)
        }

        return new Promise(
            resolve =>
                (pollInterval.current = setInterval(
                    () =>
                        auth.fetchTokens(readKey).then(tokens => {
                            clearInterval(pollInterval.current)
                            resolve(tokens)
                        }),
                    2500
                ))
        )
    }

    const login = async () => {
        setIsLoading(true)
        setHasSeenError(false)

        try {
            // Retrieve the auth URL and a set of read and write keys
            const authorization = await auth.authorize()

            // Open up the HubSpot authorization window
            window.open(authorization.url)

            // Poll the auth server and wait for tokens
            await pollForTokens(authorization.readKey)

            navigate("/menu")
        } catch (e) {
            setErrorMessage(e instanceof Error ? e.message : "An unknown error occurred.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="col-lg h-[314px]">
            <div className="col-lg items-center my-auto">
                <Logo />
                <div className="col items-center">
                    <h6>Connect to HubSpot</h6>
                    <p className="text-center max-w-[200px] text-tertiary">
                        Sign in to HubSpot to access your forms, enable tracking and more.
                    </p>
                </div>
            </div>
            <Button className="w-full mt-auto" onClick={login} isLoading={isLoading} variant="secondary">
                Log In
            </Button>
        </div>
    )
}
