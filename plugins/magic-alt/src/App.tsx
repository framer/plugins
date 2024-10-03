import { framer } from "framer-plugin"
import { useState, useMemo, useCallback, useEffect } from "react"
import { useInView } from "react-intersection-observer"
import cx from "classnames"
import { useTranslation } from "./hooks/useTranslation"
import { FrameNodeWithImage, useNoAltImages } from "./hooks/useNoAltImages"
import { generateCaptions } from "./api"
import { removeItemAtIndex } from "./utils"
import { LANGUAGES } from "./constants"

import { Spinner } from "./components/Spinner"
import { EllipsisIcon, MagicIcon } from "./components/Icons"
import { DropdownMenu } from "./components/DropdownMenu"
import { IconButton } from "./components/IconButton"
import { LanguageSelector } from "./components/LanguageSelector"

interface ImageCaptionItem {
    image: FrameNodeWithImage
    caption: string
    isLoading: boolean
}

const CAPTION_GENERATION_BATCH_SIZE = 5
const TRANSLATION_BATCH_SIZE = 2

const ENGLISH_LANGUAGE_INDEX = 24
const DEFAULT_LANGUAGE = LANGUAGES[ENGLISH_LANGUAGE_INDEX]

export function App() {
    const { ref: scrollRef, inView: isAtBottom } = useInView({ threshold: 1 })
    const { loadModel, modelLoadProgress, isModelLoading, isModelReady, translate, isTranslating } = useTranslation()

    const [images] = useNoAltImages()
    const [imageCaptionItems, setImageCaptionItems] = useState<ImageCaptionItem[]>([])
    const isGeneratingCaptions = useMemo(() => imageCaptionItems.some(item => item.isLoading), [imageCaptionItems])
    const allCaptionsBlank = useMemo(() => imageCaptionItems.every(item => item.caption === ""), [imageCaptionItems])

    const [newlyTranslatedIndices, setNewlyTranslatedIndices] = useState<number[]>([])
    const [translatingIndices, setTranslatingIndices] = useState<number[]>([])

    const [targetLanguage, setTargetLanguage] = useState(DEFAULT_LANGUAGE)
    const [sourceLanguage, setSourceLanguage] = useState(DEFAULT_LANGUAGE)
    const requiresTranslation = useMemo(
        () => sourceLanguage.value !== targetLanguage.value,
        [sourceLanguage, targetLanguage]
    )

    useEffect(() => {
        // Initialize image caption items when the images array changes
        const items = images.map(image => ({
            image,
            caption: "",
            isLoading: false,
        }))

        setImageCaptionItems(items)
    }, [images])

    useEffect(() => {
        if (requiresTranslation && !isModelLoading && !isModelReady) {
            loadModel()
            framer.notify("Loading translation model", { variant: "info" })
        }
    }, [requiresTranslation, isModelLoading, isModelReady, loadModel])

    const translateCaptions = useCallback(async () => {
        if (!requiresTranslation || !isModelReady || isTranslating) return

        for (let i = 0; i < imageCaptionItems.length; i += TRANSLATION_BATCH_SIZE) {
            const batch = imageCaptionItems.slice(i, i + TRANSLATION_BATCH_SIZE).map(item => item.caption)
            const batchIndices = Array.from({ length: TRANSLATION_BATCH_SIZE }, (_, index) => i + index).filter(
                index => index < imageCaptionItems.length && imageCaptionItems[index].caption.trim() !== ""
            )

            if (batch.length === 0) continue

            // Update UI for captions being translated
            setTranslatingIndices(prevIndices => [...prevIndices, ...batchIndices])

            try {
                const translatedBatch = await translate(batch, sourceLanguage.value, targetLanguage.value)

                // Update captions with their translated text
                setImageCaptionItems(prevItems => {
                    return prevItems.map((item, index) =>
                        batchIndices.includes(index)
                            ? { ...item, caption: translatedBatch[batchIndices.indexOf(index)] }
                            : item
                    )
                })

                setNewlyTranslatedIndices(prev => [...prev, ...batchIndices])
            } catch (e) {
                framer.notify(e instanceof Error ? e.message : String(e), { variant: "error" })
            } finally {
                // Captions are now translated, remove them
                setTranslatingIndices(prevIndices => prevIndices.filter(index => !batchIndices.includes(index)))
            }
        }

        setSourceLanguage(targetLanguage)
    }, [imageCaptionItems, requiresTranslation, isModelReady, isTranslating, translate, sourceLanguage, targetLanguage])

    useEffect(() => {
        // Check for newly translated indices
        if (newlyTranslatedIndices.length > 0) {
            // Allow for animation to occur then remove
            const timer = setTimeout(() => {
                setNewlyTranslatedIndices([])
            }, 500)

            return () => clearTimeout(timer)
        }
    }, [newlyTranslatedIndices])

    const handleTranslate = useCallback(async () => {
        if (!requiresTranslation) {
            framer.notify("Please select a different language", { variant: "warning" })
            return
        }

        if (!isModelReady) {
            framer.notify("Loading translation model", { variant: "info" })
            return
        }

        if (allCaptionsBlank) return

        await translateCaptions()
    }, [requiresTranslation, isModelReady, translateCaptions, allCaptionsBlank])

    const handleCaptionsGeneration = useCallback(async () => {
        const publishInfo = await framer.getPublishInfo()
        const siteUrl = publishInfo.staging?.url

        if (!siteUrl) {
            framer.notify("Please publish your site to staging", { variant: "error" })
            return
        }

        setNewlyTranslatedIndices([])
        setSourceLanguage(DEFAULT_LANGUAGE)
        setImageCaptionItems(prevItems =>
            prevItems.map(item => ({
                image: item.image,
                isLoading: true,
                caption: "",
            }))
        )

        for (let i = 0; i < images.length; i += CAPTION_GENERATION_BATCH_SIZE) {
            const endIndex = Math.min(i + CAPTION_GENERATION_BATCH_SIZE, images.length)
            const imageBatch = images.slice(i, endIndex).map(img => img.backgroundImage.url)

            try {
                const captionBatch = await generateCaptions(siteUrl, imageBatch)
                setImageCaptionItems(prevItems => {
                    return prevItems.map((item, index) => {
                        // Update items in current batch with new captions
                        if (index >= i && index < i + captionBatch.data.length) {
                            return {
                                ...item,
                                caption: captionBatch.data[index - i].caption,
                                isLoading: false,
                            }
                        }

                        return item
                    })
                })
            } catch (e) {
                framer.notify(e instanceof Error ? e.message : String(e), { variant: "error" })
            }
        }
    }, [images])

    const handleSaveCaptions = async () => {
        await Promise.all(
            imageCaptionItems.map(({ image }, i) =>
                image.setAttributes({
                    backgroundImage: image.backgroundImage.cloneWithAttributes({
                        altText: imageCaptionItems[i].caption,
                    }),
                })
            )
        )

        await framer.closePlugin("Alt text applied", { variant: "success" })
    }

    const handleUpdateCaption = (index: number, value: string) => {
        setImageCaptionItems(prevItems =>
            prevItems.map((item, i) => (i === index ? { ...item, caption: value } : item))
        )
    }

    if (images.length === 0) {
        return (
            <div className="flex items-center justify-center h-full px-[15px] pb-[15px]">
                <p className="text-center max-w-[190px]">All images have Alt Text</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-0 w-full h-full px-[15px] pb-[15px] select-none">
            <div className="row">
                <LanguageSelector
                    language={targetLanguage}
                    onChange={lang => setTargetLanguage(lang)}
                    disabled={isTranslating || isGeneratingCaptions}
                    className="flex-1"
                />
                <IconButton
                    className={cx("flex items-center gap-0.5 w-fit pl-[5px] pr-2", { "animate-pulse": isTranslating })}
                    onClick={handleTranslate}
                    disabled={isTranslating || isModelLoading}
                >
                    <MagicIcon />
                    <p className="text-primary">Translate</p>
                </IconButton>
            </div>
            <div className="pt-[15px] sticky top-0 z-10 bg-primary border-b border-divider">
                <div className="flex gap-5 h-[30px]">
                    <p className="w-[50px]">Image</p>
                    <div className="pl-2.5">
                        <p>Alt Text</p>
                    </div>
                </div>
            </div>
            <div className="col pt-[15px] flex-1 overflow-y-auto no-scrollbar">
                {imageCaptionItems.map(({ image, isLoading, caption }, i) => (
                    <div className="group flex items-center gap-5 h-[30px] relative" key={i}>
                        <div
                            role="button"
                            tabIndex={0}
                            className="w-[50px] h-[22px] rounded-[4px] shadow-bg-image overflow-hidden relative focus:outline-none focus-within:after:content-[''] focus-within:after:absolute focus-within:after:inset-0 focus-within:after:border focus-within:after:border-framer-blue focus-within:after:rounded-[3px]"
                            onClick={() => framer.zoomIntoView([image.id], { maxZoom: 2 })}
                        >
                            <img
                                src={image.backgroundImage.thumbnailUrl}
                                alt="Background thumbnail"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="flex-grow flex items-center">
                            <div className="w-full relative">
                                {isLoading ? (
                                    <div className="absolute inset-0 flex items-center pl-2.5 bg-transparent">
                                        <Spinner inheritColor inline />
                                    </div>
                                ) : null}
                                <input
                                    type="text"
                                    placeholder="No image caption"
                                    className={cx("w-full bg-transparent focus:bg-tertiary pl-2.5 pr-2.5 py-1.5", {
                                        "animate-pulse": translatingIndices.includes(i),
                                        "animate-expand": newlyTranslatedIndices.includes(i),
                                        "opacity-0": isLoading,
                                    })}
                                    value={caption ?? ""}
                                    onChange={e => handleUpdateCaption(i, e.target.value)}
                                    disabled={isTranslating || isGeneratingCaptions}
                                />
                            </div>
                        </div>
                        <DropdownMenu
                            menuItems={[
                                {
                                    label: "Ignore",
                                    onClick: () => setImageCaptionItems(prevItems => removeItemAtIndex(prevItems, i)),
                                },
                            ]}
                        >
                            {({ isOpen }) => (
                                <IconButton
                                    className={cx("opacity-0", {
                                        "opacity-100": isOpen,
                                        "group-hover:opacity-100": !isOpen && !isGeneratingCaptions && !isTranslating,
                                        "bg-[#ddd] dark:bg-[#232323]": isOpen,
                                        "pointer-events-none": isGeneratingCaptions || isTranslating,
                                    })}
                                >
                                    <EllipsisIcon />
                                </IconButton>
                            )}
                        </DropdownMenu>
                    </div>
                ))}
                <div ref={scrollRef} className="h-0 w-0"></div>
            </div>
            {!isAtBottom && <div className="scroll-fade"></div>}
            <div className="sticky bottom-0 left-0 z-10 flex flex-col">
                <div className="h-px w-full bg-divider relative overflow-hidden">
                    <div
                        className={cx("h-full bg-tint absolute top-0 left-0 loading-transition", {
                            "opacity-0": modelLoadProgress === 100,
                        })}
                        style={{
                            width: `${modelLoadProgress}%`,
                        }}
                    ></div>
                </div>
                <div className="flex gap-2 pt-[15px] *:flex-1">
                    <button onClick={handleSaveCaptions} disabled={isGeneratingCaptions || isTranslating}>
                        Apply
                    </button>
                    <button
                        className="framer-button-primary"
                        onClick={handleCaptionsGeneration}
                        disabled={isGeneratingCaptions || isTranslating}
                    >
                        Generate
                    </button>
                </div>
            </div>
        </div>
    )
}
