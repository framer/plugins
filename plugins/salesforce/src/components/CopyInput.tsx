import { useState } from "react"
import { CopyIcon, TickIcon } from "./Icons"
import { Spinner } from "./Spinner"
import { framer } from "framer-plugin"

interface Props {
    value: string
    isLoading?: boolean
    message?: string
}

export const CopyInput = ({ value, isLoading, message }: Props) => {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)

        if (message) {
            framer.notify(message)
        }
    }

    return (
        <div className="row gap-2">
            <input type="text" defaultValue={value} className="flex-1" readOnly />
            <button className="w-[30px] h-[30px] p-0 flex items-center justify-center" onClick={handleCopy}>
                {isLoading ? <Spinner className="mx-auto" inheritColor inline /> : copied ? <TickIcon /> : <CopyIcon />}
            </button>
        </div>
    )
}
