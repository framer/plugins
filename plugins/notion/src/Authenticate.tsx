import { useState } from "react"
import { PluginContext, authorize, getPluginContext } from "./notion"
import loginIllustration from "./assets/notion-login.png"
import { Button } from "./components/Button"

export function Authentication({ onAuthenticated }: { onAuthenticated: (context: PluginContext) => void }) {
    const [isLoading, setIsLoading] = useState(false)

    const handleAuth = async () => {
        try {
            setIsLoading(true)
            await authorize()
            const authenticatedContext = await getPluginContext()
            onAuthenticated(authenticatedContext)
        } finally {
            setIsLoading(false)
        }
    }
    return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 pb-4 overflo">
            <img src={loginIllustration} className="max-w-100% rounded-md flex-shrink-0" />
            <div className="flex flex-col items-center gap-2 flex-1 justify-center w-full">
                {isLoading ? (
                    <span className="text-center max-w-[80%] block text-secondary">
                        Complete the authentication and return to this page.
                    </span>
                ) : (
                    <ol className="list-inside list-decimal w-full text-secondary gap-2 text-md flex flex-col flex-1">
                        <li>Log in to your Notion account</li>
                        <li>Pick the database you want to import</li>
                        <li>Map the database fields to the CMS</li>
                    </ol>
                )}
            </div>

            <Button variant="primary" onClick={handleAuth} isLoading={isLoading} disabled={isLoading}>
                Log in to Notion
            </Button>
        </div>
    )
}
