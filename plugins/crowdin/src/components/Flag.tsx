import { useState } from "react"
import { regionToFlagEmoji } from "../regionFlags"
import { parseLocaleCode } from "../utils"

export function Flag({ code }: { code: string }) {
    const { language, region } = parseLocaleCode(code)
    const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading")

    if (region && status !== "error") {
        const flagEmoji = regionToFlagEmoji[region]
        if (flagEmoji) {
            return (
                <>
                    <img
                        className="flag-icon emoji"
                        src={emojiToURL(flagEmoji)}
                        alt={flagEmoji}
                        style={{ display: status === "loaded" ? undefined : "none" }}
                        onLoad={() => {
                            setStatus("loaded")
                        }}
                        onError={() => {
                            setStatus("error")
                        }}
                    />
                    {status === "loading" && <div className="flag-icon basic" />}
                </>
            )
        }
    }

    return <div className="flag-icon basic">{language}</div>
}

function emojiToURL(emoji: string): string {
    // eslint-disable-next-line @typescript-eslint/no-misused-spread
    const codepoint = [...emoji].map(char => (char.codePointAt(0) ?? 0).toString(16)).join("-")
    return `https://cdnjs.cloudflare.com/ajax/libs/twemoji/15.1.0/72x72/${codepoint}.png`
}
