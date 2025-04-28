import { framer } from "framer-plugin"
import { useCallback, useEffect, useState } from "react"

export function usePluginData(
    id: string,
    { onLoad }: { onLoad?: (data: string | null) => void } = {}
): [string | null, (value: string) => void] {
    const [data, setDataInternal] = useState<string | null>(null)

    useEffect(() => {
        const get = async () => {
            const data = await framer.getPluginData(id)
            setDataInternal(data ?? null)
            onLoad?.(data ?? null)
        }

        get()
    }, [id])

    const setData = useCallback(
        async (value: string | null) => {
            await framer.setPluginData(id, value)
            setDataInternal(value)
        },
        [id]
    )

    return [data, setData]
}
