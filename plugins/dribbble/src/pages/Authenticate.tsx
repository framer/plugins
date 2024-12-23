import { useRef, useState } from "react"
import auth from "../auth"
import { Button } from "../components/Button"
import { getPluginContext, PluginContext } from "../sync"
import { framer } from "framer-plugin"

interface Props {
    onAuthenticated: (context: PluginContext) => void
}

export default function Authenticate({ onAuthenticated }: Props) {
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
                    1500
                ))
        )
    }

    const login = async () => {
        setIsLoading(true)

        try {
            const authorization = await auth.authorize()
            window.open(authorization.url)
            await pollForTokens(authorization.readKey)

            onAuthenticated(await getPluginContext())
        } catch (e) {
            framer.notify(e instanceof Error ? e.message : JSON.stringify(e), { variant: "error" })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <main>
            <div className="col-lg items-center my-auto">
                <img src="/icon.svg" alt="Dribbble Logo" className="rounded-lg" />
                <div className="col items-center">
                    <h6>Connect to Dribbble</h6>
                    <p className="text-center max-w-[200px] text-tertiary">
                        Sign in to Dribbble to sync shots and import your content.
                    </p>
                </div>
            </div>
            <Button className="w-full mt-auto" onClick={login} isLoading={isLoading} variant="secondary">
                Log In
            </Button>
        </main>
    )
}
