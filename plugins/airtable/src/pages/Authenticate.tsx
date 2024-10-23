import { useLayoutEffect, useRef, useState } from "react"
import { framer } from "framer-plugin"
import { getPluginContext, PluginContext } from "../airtable"
import auth from "../auth"

import { Button } from "../components/Button"
import { Hero } from "../components/Hero"

interface AuthenticationProps {
    onAuthenticated: (context: PluginContext) => void
}

export function Authenticate({ onAuthenticated }: AuthenticationProps) {
    const [isLoading, setIsLoading] = useState(false)
    const pollInterval = useRef<number | ReturnType<typeof setInterval>>()

    useLayoutEffect(() => {
        framer.showUI({
            width: 320,
            height: 345,
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

    const login = async () => {
        setIsLoading(true)

        try {
            // Retrieve the auth URL and a set of read and write keys
            const authorization = await auth.authorize()

            // Open up the Airtable authorization window
            window.open(authorization.url)

            // Poll the auth server and wait for tokens
            await pollForTokens(authorization.readKey)

            onAuthenticated(await getPluginContext())
        } catch (e) {
            framer.notify(e instanceof Error ? e.message : "An unknown error ocurred")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="col-lg pb-[15px]">
            <Hero />
            <ol className="list-decimal list-inside space-y-2.5 marker:text-secondary *:text-tertiary *:leading-none *:tracking-normal py-[7px]">
                <li>Log in to your Airtable account</li>
                <li>Pick the base you want to import</li>
                <li>Map the table fields to the CMS</li>
            </ol>
            <Button variant="secondary" className="w-full" onClick={login} isLoading={isLoading}>
                Log In
            </Button>
        </div>
    )
}
