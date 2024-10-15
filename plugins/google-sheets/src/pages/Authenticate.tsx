import { useRef, useState } from "react"
import { framer } from "framer-plugin"
import { getPluginContext, PluginContext } from "../sheets"
import auth from "../auth"

import { Hero } from "../components/Hero"

import { Button } from "../components/Button"
import { GoogleLogo } from "../components/GoogleLogo"

interface AuthenticationProps {
    onAuthenticated: (context: PluginContext) => void
}

export function Authenticate({ onAuthenticated }: AuthenticationProps) {
    const [isLoading, setIsLoading] = useState(false)
    const pollInterval = useRef<number | ReturnType<typeof setInterval>>()

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
                    10_000
                ))
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
            framer.notify(e instanceof Error ? e.message : "An unknown error ocurred")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="col-lg pb-[15px]">
            <Hero />
            <ol className="list-decimal list-inside space-y-2.5 marker:text-secondary *:text-content *:leading-none *:tracking-normal py-[7px]">
                <li>
                    <span className="pl-[10px]">Log in to your Google account</span>
                </li>
                <li>
                    <span className="pl-[10px]">Ensure your sheet has a header row</span>
                </li>
                <li>
                    <span className="pl-[10px]">Map the column fields to the CMS</span>
                </li>
            </ol>
            <Button
                variant="secondary"
                onClick={login}
                isLoading={isLoading}
                className="w-full inline-flex gap-[5px] items-center"
            >
                <GoogleLogo /> <span className="relative top-[1px]">Sign In</span>
            </Button>
        </div>
    )
}
