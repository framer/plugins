import { framer } from "framer-plugin"
import { useEffect, useState } from "react"
import { PLUGIN_KEYS } from "./data"
import { Auth } from "./components/auth"
import Page from "./page"

export function AppCanvas({ previousBoardToken }: { previousBoardToken: string | null }) {
    const [isLoading, setIsLoading] = useState(Boolean(previousBoardToken))
    const [boardToken, setBoardToken] = useState<string | null>(previousBoardToken)

    useEffect(() => {
        framer.showUI({
            width: 360,
            height: 360,
        })
    }, [])

    useEffect(() => {
        const abortController = new AbortController()

        async function init() {
            setIsLoading(true)

            try {
                if (!previousBoardToken) return
                const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${previousBoardToken}`, {
                    signal: abortController.signal,
                })
                if (response.status === 200) {
                    setBoardToken(previousBoardToken)
                } else {
                    throw new Error(
                        `Error loading previously configured board “${previousBoardToken}”. Check the logs for more details.`
                    )
                }
            } catch (error) {
                if (abortController.signal.aborted) return
                console.error(error)
                framer.notify(error instanceof Error ? error.message : "An unknown error occurred", {
                    variant: "error",
                })
            } finally {
                if (!abortController.signal.aborted) {
                    setIsLoading(false)
                }
            }
        }

        init()

        return () => {
            abortController.abort()
        }
    }, [previousBoardToken])

    if (isLoading) {
        return (
            <main className="loading">
                <div className="framer-spinner" />
            </main>
        )
    }

    if (!boardToken) {
        return (
            <Page width={360}>
                <Auth
                    onAuth={boardToken => {
                        setBoardToken(boardToken)
                    }}
                />
            </Page>
        )
    }

    return (
        <Page width={260} previousPage="Board Token" onPreviousPage={() => setBoardToken(null)}>
            <div className="setup canvas">
                <div className="intro">
                    <img src="/Icon.png" alt="Greenhouse" className="icon" />
                    <div>
                        <h2>Welcome to Greenhouse</h2>
                        <p>Seamlessly add and manage job application forms on your site.</p>
                    </div>
                </div>
                <button
                    onClick={async () => {
                        const spaceId = await framer.getPluginData(PLUGIN_KEYS.SPACE_ID)

                        await framer.addComponentInstance({
                            url: "https://framer.com/m/GreenhouseIframe-99J5.js",
                            attributes: {
                                controls: {
                                    jobId: "",
                                    boardToken: spaceId,
                                },
                            },
                        })
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18">
                        <path
                            d="M 0 4 C 0 1.791 1.791 0 4 0 L 14 0 C 16.209 0 18 1.791 18 4 L 18 14 C 18 16.209 16.209 18 14 18 L 4 18 C 1.791 18 0 16.209 0 14 Z M 4 9 C 4 9.552 4.448 10 5 10 L 13 10 C 13.552 10 14 9.552 14 9 C 14 8.448 13.552 8 13 8 L 5 8 C 4.448 8 4 8.448 4 9 Z M 6 5 C 6 5.552 6.448 6 7 6 L 11 6 C 11.552 6 12 5.552 12 5 C 12 4.448 11.552 4 11 4 L 7 4 C 6.448 4 6 4.448 6 5 Z M 6 13 C 6 13.552 6.448 14 7 14 L 11 14 C 11.552 14 12 13.552 12 13 C 12 12.448 11.552 12 11 12 L 7 12 C 6.448 12 6 12.448 6 13 Z"
                            fill="#999999"
                        ></path>
                    </svg>
                    <p>Job Embed</p>
                </button>
            </div>
        </Page>
    )
}
