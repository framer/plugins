import "./App.css"

import { useLayoutEffect, useRef, useState } from "react"
import { framer } from "framer-plugin"
import auth from "./auth"
import { Hero } from "./components/Hero"
import { GoogleLogo } from "./components/GoogleLogo"

interface AuthenticationProps {
    onAuthenticated: () => void
}

export function Authenticate({ onAuthenticated }: AuthenticationProps) {
    const [isLoading, setIsLoading] = useState(false)
    const pollInterval = useRef<number | ReturnType<typeof setInterval>>()
    const pollTimeout = useRef<number | ReturnType<typeof setTimeout>>()

    useLayoutEffect(() => {
        framer.showUI({
            width: 320,
            height: 340,
        })
    }, [])

    const pollForTokens = (readKey: string) => {
        if (pollInterval.current) {
            clearInterval(pollInterval.current)
        }

        return new Promise(
            (resolve, reject) =>
                (pollInterval.current = setInterval(
                    () =>
                        auth
                            .fetchTokens(readKey)
                            .then(tokens => {
                                // Tokens have no been received yet.
                                if (!tokens) return

                                clearInterval(pollInterval.current)
                                resolve(tokens)
                            })
                            .catch(reject),
                    1500
                ))
        )
    }

    const login = async (e: React.FormEvent) => {
        e.preventDefault() // Prevent form submission from reloading the page

        setIsLoading(true)

        try {
            // Retrieve the auth URL and a set of read and write keys
            const authorization = await auth.authorize()

            // Open up the Google authorization window
            window.open(authorization.url)

            // Poll the auth server and wait for tokens
            await pollForTokens(authorization.readKey)

            onAuthenticated()
        } catch (e) {
            framer.notify(e instanceof Error ? e.message : "An unknown error ocurred")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <form className="login" onSubmit={login}>
            <Hero />

            <ol className="login-steps">
                <li>Log in to your Google account</li>
                <li>Ensure your sheet has a header row</li>
                <li>Map the column fields to the CMS</li>
            </ol>

            <button type="submit" className="login-button">
                {isLoading ? (
                    <div className="framer-spinner" />
                ) : (
                    <>
                        <GoogleLogo /> Sign In
                    </>
                )}
            </button>
        </form>
    )
}
