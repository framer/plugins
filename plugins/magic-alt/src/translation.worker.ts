import { env, pipeline, TranslationOutput, TranslationPipeline } from "@xenova/transformers"
import { GenerationConfigType } from "@xenova/transformers/types/utils/generation"

// See: https://github.com/xenova/transformers.js/issues/366
env.allowLocalModels = false
env.allowRemoteModels = true
env.useBrowserCache = false

// See: https://github.com/xenova/transformers.js/issues/270
const originalWarn = console.warn

console.warn = function (...args) {
    if (!args[0].includes("onnxruntime")) {
        originalWarn.apply(console, args)
    }
}

export interface TranslationRequest {
    action: "translate"
    texts: string[]
    src_lang: string
    tgt_lang: string
}

export interface LoadModelRequest {
    action: "load_model"
}

export type WorkerRequest = TranslationRequest | LoadModelRequest

export interface ProgressData {
    file: string
    progress: number
    loaded: number
    total: number
}

export type Outputs = string[]

interface ModelCallbackOutput {
    output_token_ids: number[]
}

class TranslationSingleton {
    static instance: Promise<TranslationPipeline> | null = null

    static async getInstance(progress_callback: (data: ProgressData) => void) {
        if (this.instance === null) {
            this.instance = pipeline("translation", "Xenova/nllb-200-distilled-600M", {
                progress_callback,
                quantized: true,
            })
        }

        return this.instance
    }
}

let translator: TranslationPipeline | null = null

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
    const eventData = event.data

    switch (eventData.action) {
        case "load_model": {
            translator = await TranslationSingleton.getInstance(x => {
                // Track model loading progress
                self.postMessage(x)
            })

            break
        }

        case "translate": {
            if (!translator) {
                self.postMessage({ status: "error", message: "Please load the model before translating" })
                return
            }

            const { texts, src_lang, tgt_lang } = eventData

            try {
                const outputs = (await translator(texts, {
                    tgt_lang,
                    src_lang,
                    // Allow for partial output
                    callback_function: (x: ModelCallbackOutput[]) => {
                        const decodedOutputs = x.map(output =>
                            translator!.tokenizer.decode(output.output_token_ids, { skip_special_tokens: true })
                        )

                        self.postMessage({
                            status: "update",
                            outputs: decodedOutputs,
                        })
                    },
                } as GenerationConfigType)) as TranslationOutput

                self.postMessage({
                    status: "complete",
                    outputs: outputs.map(output => output.translation_text),
                })
            } catch (e) {
                self.postMessage({ status: "error", message: e instanceof Error ? e.message : String(e) })
            }

            break
        }

        default:
            self.postMessage({ status: "error", message: "Unknown action" })
    }
})
