import { CustomCode, framer } from "framer-plugin"
import { useState, useEffect } from "react"

export const useCustomCode = () => {
    const [customCode, setCustomCode] = useState<CustomCode | null>(null)

    useEffect(() => framer.subscribeToCustomCode(setCustomCode), [])

    return customCode
}
