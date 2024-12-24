import { useAccountEngagementFormHandlers } from "@/api"
import { ScrollFadeContainer } from "@/components/ScrollFadeContainer"
import auth from "@/auth"
import { CenteredSpinner } from "@/components/CenteredSpinner"
import { CopyIcon, TickIcon } from "@/components/Icons"
import { useState } from "react"
import { BACKEND_URL } from "@/constants"
import { framer } from "framer-plugin"
import { Message } from "@/components/Message"

export default function AccountEngagementFormHandlers() {
    const { data: handlers, isLoading } = useAccountEngagementFormHandlers()
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

    const handleCopy = async (handler: string, index: number) => {
        await navigator.clipboard.writeText(`${BACKEND_URL}/api/forms/account-engagement/forward?handler=${handler}`)
        framer.notify("Paste the webhook into your Framer Form webhook settings")
        setCopiedIndex(index)
        setTimeout(() => setCopiedIndex(null), 2000)
    }

    if (isLoading) return <CenteredSpinner />

    if (!handlers) return null

    if (handlers.length === 0) {
        return (
            <Message title="No Form Handlers">
                Create a form handler in Account Engagement to add it to your Framer site
            </Message>
        )
    }

    return (
        <div className="flex flex-col gap-0 p-[15px]">
            <p>
                Create a Framer form with field names matching the form handler fields, then add the webhook URL below.
            </p>
            <ScrollFadeContainer className="col py-[15px]" height={172}>
                {handlers.map((form, index) => (
                    <div
                        key={index}
                        className="bg-tertiary min-h-[30px] row items-center rounded-lg pl-[15px] pr-[15px] font-semibold text-secondary relative"
                    >
                        <p className="flex-grow max-w-[190px] text-ellipsis text-nowrap overflow-hidden">{form.name}</p>
                        <button
                            className="absolute right-0 w-fit !bg-transparent hover:bg-transparent"
                            onClick={() => handleCopy(form.url, index)}
                        >
                            {copiedIndex === index ? <TickIcon /> : <CopyIcon />}
                        </button>
                    </div>
                ))}
            </ScrollFadeContainer>
            <div className="col-lg sticky top-0 left-0">
                <hr />
                <button
                    className="framer-button-primary"
                    onClick={() =>
                        window.open(
                            `${auth.tokens.getOrThrow().instanceUrl}/lightning/page/pardot/form%2Fforms`,
                            "_blank"
                        )
                    }
                >
                    View Forms
                </button>
            </div>
        </div>
    )
}
