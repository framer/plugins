import "./App.css"

import { framer } from "framer-plugin"
import { useLayoutEffect, useRef } from "react"
import auth from "./auth"
import { showLoginUI } from "./ui"

interface AuthenticationProps {
    onAuthenticated: () => void
}

export function Authenticate({ onAuthenticated }: AuthenticationProps) {
    const pollInterval = useRef<number | ReturnType<typeof setInterval>>()

    useLayoutEffect(() => {
        void showLoginUI()
    }, [])

    const pollForTokens = (readKey: string) => {
        if (pollInterval.current) {
            clearInterval(pollInterval.current)
        }

        return new Promise(resolve => {
            const task = async () => {
                const tokens = await auth.fetchTokens(readKey)
                clearInterval(pollInterval.current)
                resolve(tokens)
            }

            pollInterval.current = setInterval(() => void task(), 2500)
        })
    }

    const login = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const task = async () => {
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
            }
        }

        void task()
    }

    return (
        <form className="login" onSubmit={login}>
            <div className="logo">
                <img src="airtable.svg" alt="Airtable icon" style={{ width: 80, height: 80 }} />
            </div>

            <ol className="login-steps">
                <li>Log in to your Airtable account</li>
                <li>Pick the base you want to import</li>
                <li>Map the table fields to the CMS</li>
            </ol>

            <button className="action-button" type="submit">
                Log In
            </button>
        </form>
    )
}
