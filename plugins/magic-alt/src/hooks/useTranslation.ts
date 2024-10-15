import { useEffect, useMemo, useRef, useState } from "react"
import { framer } from "framer-plugin"
import { Outputs, ProgressData, WorkerRequest } from "../translation.worker"

interface InitPipelineEvent {
    status: "initiate"
    file: string
}

interface InitPipelineProgressEvent extends ProgressData {
    status: "progress"
}

interface InitPipelineDoneEvent extends ProgressData {
    status: "done"
}

interface PipelineReadyEvent {
    status: "ready"
}

interface TranslateUpdateEvent {
    status: "update"
    outputs: Outputs
}

interface TranslateCompleteEvent {
    status: "complete"
    outputs: Outputs
}

interface ErrorEvent {
    status: "error"
    message: string
}

type WorkerResponse =
    | InitPipelineEvent
    | InitPipelineProgressEvent
    | InitPipelineDoneEvent
    | PipelineReadyEvent
    | TranslateUpdateEvent
    | TranslateCompleteEvent
    | ErrorEvent

export const useTranslation = () => {
    const worker = useRef<Worker | null>(null)

    const [outputs, setOutputs] = useState<string[]>([])
    const [isModelReady, setIsModelReady] = useState(false)
    const [isModelLoading, setIsModelLoading] = useState(false)
    const [isTranslating, setIsTranslating] = useState(false)
    const [progressItems, setProgressItems] = useState<ProgressData[]>([])

    const translationResolve = useRef<((outputs: Outputs) => void) | null>(null)
    const translationReject = useRef<((reason: Error) => void) | null>(null)

    const postMessage = (request: WorkerRequest) => {
        return worker.current?.postMessage(request)
    }

    const modelLoadProgress = useMemo(() => {
        const hasDeterminedFileTotals = progressItems.every(item => item.total !== 0)
        if (progressItems.length === 0 || !hasDeterminedFileTotals) return 0

        const totalBytes = progressItems.reduce((sum, item) => sum + item.total, 0)
        const loadedBytes = progressItems.reduce((sum, item) => sum + item.loaded, 0)

        if (totalBytes === 0) return 0

        return Math.round((loadedBytes / totalBytes) * 100)
    }, [progressItems])

    useEffect(() => {
        if (!worker.current) {
            worker.current = new Worker(new URL("../translation.worker.ts", import.meta.url), {
                type: "module",
            })
        }

        const onMessageReceived = (e: MessageEvent<WorkerResponse>) => {
            const eventData = e.data

            switch (eventData.status) {
                case "initiate":
                    // Model file start load: add to progress items for tracking
                    setProgressItems(prev => [...prev, { ...eventData, total: 0, loaded: 0, progress: 0 }])
                    setIsModelLoading(true)
                    break

                case "progress":
                    // Model file progress: update progress items
                    setProgressItems(items => items.map(item => (item.file === eventData.file ? eventData : item)))
                    break

                case "update":
                    // Generation update: update the real-time outputs
                    setOutputs(eventData.outputs)
                    break

                case "ready":
                    // Pipeline ready: worker ready to accept messages
                    setIsModelLoading(false)
                    setIsModelReady(true)
                    break

                case "complete":
                    // Translation complete
                    setIsTranslating(false)

                    if (translationResolve.current) {
                        translationResolve.current(eventData.outputs)
                        translationResolve.current = null
                        translationReject.current = null
                    }

                    break

                case "error":
                    framer.notify(eventData.message, { variant: "error" })

                    if (translationReject.current) {
                        translationReject.current(new Error(eventData.message))
                        translationResolve.current = null
                        translationReject.current = null
                    }

                    break
            }
        }

        worker.current?.addEventListener("message", onMessageReceived)

        return () => worker.current?.removeEventListener("message", onMessageReceived)
    }, [])

    const loadModel = () => {
        postMessage({ action: "load_model" })
    }

    const translate = async (texts: string[], src_lang: string, tgt_lang: string): Promise<Outputs> => {
        setIsTranslating(true)

        return new Promise<Outputs>((resolve: (outputs: Outputs) => void, reject) => {
            translationResolve.current = resolve
            translationReject.current = reject

            postMessage({ action: "translate", texts, src_lang, tgt_lang })
        }).finally(() => setIsTranslating(false))
    }

    return {
        loadModel,
        modelLoadProgress,
        translate,
        isTranslating,
        isModelLoading,
        isModelReady,
        outputs,
    }
}
