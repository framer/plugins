import { framer } from "framer-plugin"
import { useLayoutEffect, useRef, useState } from "react"
import auth from "../auth"
import { Button } from "../components/Button"
import { GoogleLogo } from "../components/GoogleLogo"
import { Hero } from "../components/Hero"
import { getPluginContext, type PluginContext } from "../sheets"

interface AuthenticationProps {
    onAuthenticated: (context: PluginContext) => void
}

export function Authenticate({ onAuthenticated }: AuthenticationProps) {
    const [isLoading, setIsLoading] = useState(false)
    const pollInterval = useRef<number | ReturnType<typeof setInterval>>()

    useLayoutEffect(() => {
        void framer.showUI({
            width: 320,
            height: 345,
        })
    }, [])

    const pollForTokens = (readKey: string) => {
        if (pollInterval.current) {
            clearInterval(pollInterval.current)
        }

        return new Promise((resolve, reject) => {
            const task = async () => {
                try {
                    const tokens = await auth.fetchTokens(readKey)
                    // Tokens have no been received yet.
                    if (!tokens) return
                    clearInterval(pollInterval.current)
                    resolve(tokens)
                } catch (error) {
                    reject(error as Error) // Just forwarding
                }
            }

            pollInterval.current = setInterval(() => void task(), 1500)
        })
    }

    const login = () => {
        setIsLoading(true)

        const task = async () => {
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

        void task()
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
                className="w-full inline-flex gap-[8px] items-center"
            >
                <GoogleLogo /> <span className="relative">Sign In</span>
            </Button>
        </div>
    )
}
