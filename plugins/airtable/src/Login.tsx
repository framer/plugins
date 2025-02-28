import "./App.css"

import { useLayoutEffect, useRef } from "react"
import { framer } from "framer-plugin"
import auth from "./auth"

interface AuthenticationProps {
    onAuthenticated: () => void
}

export function Authenticate({ onAuthenticated }: AuthenticationProps) {
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

    const login = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

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
