import { useRef, useState } from "react"
import { framer } from "framer-plugin"
import auth from "@/auth"
import { Button } from "@/components/Button"
import { Logo } from "@/components/Logo"
import { useLocation } from "wouter"

export default function Auth() {
    const pollInterval = useRef<number | ReturnType<typeof setInterval>>()
    const [, navigate] = useLocation()
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState("Sign in to Salesforce to access forms, enable tracking, and more.")

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
                    1500
                ))
        )
    }

    const login = async () => {
        setIsLoading(true)

        try {
            setMessage("Complete the authentication and return to Framer.")

            const authorize = await auth.authorize()

            // Open Salesforce authorization window
            window.open(authorize.url)

            // Fetch tokens
            await pollForTokens(authorize.readKey)

            navigate("/business-unit-id")
        } catch (e) {
            framer.notify(e instanceof Error ? e.message : "An unknown error occurred.", { variant: "error" })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <main>
            <div className="col-lg items-center my-auto">
                <Logo />
                <div className="col items-center">
                    <h6>Connect to Salesforce</h6>
                    <p className="text-center max-w-[200px] text-tertiary">{message}</p>
                </div>
            </div>
            <Button className="w-full mt-auto" onClick={login} isLoading={isLoading} variant="secondary">
                Log In
            </Button>
        </main>
    )
}
