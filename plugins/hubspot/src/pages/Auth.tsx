import { framer } from "framer-plugin"
import { useRef, useState } from "react"
import { useLocation } from "wouter"
import auth from "../auth"
import { Button } from "../components/Button"
import { Logo } from "../components/Logo"

export default function AuthPage() {
    const [, navigate] = useLocation()
    const [isLoading, setIsLoading] = useState(false)
    const pollInterval = useRef<number | ReturnType<typeof setInterval>>()

    const pollForTokens = (readKey: string) => {
        if (pollInterval.current) {
            clearInterval(pollInterval.current)
        }

        return new Promise<void>(
            resolve =>
                (pollInterval.current = setInterval(
                    () =>
                        void auth.fetchTokens(readKey).then(() => {
                            clearInterval(pollInterval.current)
                            resolve()
                        }),
                    1500
                ))
        )
    }

    const login = () => {
        setIsLoading(true)

        const task = async () => {
            try {
                // Retrieve the auth URL and a set of read and write keys
                const authorization = await auth.authorize()

                // Open up the HubSpot authorization window
                window.open(authorization.url)

                // Poll the auth server and wait for tokens
                await pollForTokens(authorization.readKey)

                navigate(framer.mode === "canvas" ? "/canvas" : "/cms")
            } catch (e) {
                framer.notify(e instanceof Error ? e.message : "An unknown error occurred.", { variant: "error" })
            } finally {
                setIsLoading(false)
            }
        }

        void task()
    }

    return (
        <main>
            <div className="col-lg items-center my-auto">
                <Logo />
                <div className="col items-center">
                    <h6>Connect to HubSpot</h6>
                    <p className="text-center max-w-[200px] text-tertiary">
                        Sign in to HubSpot to access your forms, enable tracking and more.
                    </p>
                </div>
            </div>
            <Button className="w-full" onClick={login} isLoading={isLoading} variant="secondary">
                Log In
            </Button>
        </main>
    )
}
