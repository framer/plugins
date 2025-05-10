import "./App.css"

import { useLayoutEffect, useRef, useState } from "react"
import { framer } from "framer-plugin"
import auth from "./auth"

interface AuthenticationProps {
    onAuthenticated: () => void
}

export function Authenticate({ onAuthenticated }: AuthenticationProps) {
    const [isLoading, setIsLoading] = useState(false)
    const pollInterval = useRef<number | ReturnType<typeof setInterval>>()

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

        return new Promise(resolve => {
            const fetchTokens = () => {
                auth.fetchTokens(readKey).then(tokens => {
                    clearInterval(pollInterval.current)
                    resolve(tokens)
                })
            }

            // Initial 10 second delay
            setTimeout(fetchTokens, 10000)

            // Set up subsequent polling every 2.5 seconds
            pollInterval.current = setInterval(fetchTokens, 2500)
        })
    }

    const login = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        setIsLoading(true)

        try {
            // Retrieve the auth URL and a set of read and write keys
            const authorization = await auth.authorize()

            // Open up the Airtable authorization window
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
            <img src="/notion-doodle.png" className="login-image" />

            <ol className="login-steps">
                <li>Log in to your Notion account</li>
                <li>Pick the database you want to import</li>
                <li>Map the database fields to the CMS</li>
            </ol>

            <button type="submit">Log In</button>
        </form>
    )
}
