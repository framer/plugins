import { QueryErrorResetBoundary, useMutation } from "@tanstack/react-query"
import cx from "classnames"
import { Draggable, framer, useIsAllowedTo } from "framer-plugin"
import {
    memo,
    type PropsWithChildren,
    useCallback,
    useDeferredValue,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { Blurhash } from "react-blurhash"
import { ErrorBoundary } from "react-error-boundary"
import { getRandomPhoto, type UnsplashPhoto, useListPhotosInfinite } from "./api"
import { SearchIcon } from "./icons"
import { Spinner } from "./Spinner"

const mode = framer.mode

const minWindowWidth = mode === "canvas" ? 260 : 600
const minColumnWidth = 100
const columnGap = 5
const sidePadding = 15 * 2
const resizable = framer.mode === "canvas"

void framer.showUI({
    position: "top right",
    width: minWindowWidth,
    minWidth: minWindowWidth,
    maxWidth: 750,
    minHeight: 400,
    resizable,
})

export function App() {
    const isAllowedToUpsertImage = useIsAllowedTo("addImage", "setImage")

    const [query, setQuery] = useState("")

    const debouncedQuery = useDebounce(query, 200)

    const addRandomMutation = useMutation({
        mutationFn: async (query: string) => {
            const mode = framer.mode
            const randomPhoto = await getRandomPhoto(query)

            if (mode === "canvas") {
                await framer.addImage({
                    image: randomPhoto.urls.full,
                    name: randomPhoto.alt_description ?? randomPhoto.description ?? "Unsplash Image",
                    altText: randomPhoto.alt_description ?? randomPhoto.description ?? undefined,
                })
                return
            }

            await framer.setImage({
                image: randomPhoto.urls.full,
                name: randomPhoto.alt_description ?? randomPhoto.description ?? "Unsplash Image",
                altText: randomPhoto.alt_description ?? randomPhoto.description ?? undefined,
            })

            await framer.closePlugin()
        },
    })

    return (
        <div className="flex flex-col gap-0 pb-4 h-full">
            <div className="bg-primary mb-[15px] z-10 relative px-[15px]">
                <input
                    type="text"
                    placeholder="Search…"
                    value={query}
                    className="w-full pl-[33px] pr-8"
                    autoFocus
                    style={{ paddingLeft: 30 }}
                    onChange={e => {
                        setQuery(e.target.value)
                    }}
                />
                <div className="flex items-center justify-center absolute left-[25px] top-0 bottom-0 text-tertiary">
                    <SearchIcon />
                </div>
            </div>
            <AppErrorBoundary>
                <PhotosList query={debouncedQuery} />
            </AppErrorBoundary>
            <div className="mt-[15px] px-[15px]">
                <button
                    className="items-center flex justify-center relative"
                    onClick={() => {
                        if (!isAllowedToUpsertImage) return
                        addRandomMutation.mutate(query)
                    }}
                    disabled={!isAllowedToUpsertImage}
                    title={isAllowedToUpsertImage ? undefined : "Insufficient permissions"}
                >
                    {addRandomMutation.isPending ? <Spinner size="normal" inheritColor /> : "Random Image"}
                </button>
            </div>
        </div>
    )
}

type PhotoId = string

const PhotosList = memo(function PhotosList({ query }: { query: string }) {
    const isAllowedToUpsertImage = useIsAllowedTo("addImage", "setImage")

    const { data, fetchNextPage, isFetchingNextPage, isLoading, hasNextPage } = useListPhotosInfinite(query)
    const scrollRef = useRef<HTMLDivElement>(null)
    const [windowWidth, setWindowWidth] = useState(window.innerWidth)
    const deferredWindowWidth = useDeferredValue(windowWidth)
    const previousWindowHeightRef = useRef(window.innerHeight)

    const handleScroll = useCallback(() => {
        if (isFetchingNextPage || isLoading) return

        const scrollElement = scrollRef.current
        if (!scrollElement) return

        const distanceToEnd = scrollElement.scrollHeight - (scrollElement.clientHeight + scrollElement.scrollTop)

        if (distanceToEnd > 150) return

        void fetchNextPage()
    }, [isFetchingNextPage, isLoading, fetchNextPage])

    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth)

            // Handle vertical window resize
            if (window.innerHeight > previousWindowHeightRef.current) {
                handleScroll()
            }

            previousWindowHeightRef.current = window.innerHeight
        }

        handleResize()
        window.addEventListener("resize", handleResize)
        return () => {
            window.removeEventListener("resize", handleResize)
        }
    }, [handleScroll])

    const addPhotoMutation = useMutation({
        mutationFn: async (photo: UnsplashPhoto) => {
            const mode = framer.mode

            if (mode === "canvas") {
                await framer.addImage({
                    image: photo.urls.full,
                    name: photo.alt_description ?? photo.description ?? "Unsplash Image",
                    altText: photo.alt_description ?? photo.description ?? undefined,
                })

                return
            }

            await framer.setImage({
                image: photo.urls.full,
                name: photo.alt_description ?? photo.description ?? "Unsplash Image",
                altText: photo.alt_description ?? photo.description ?? undefined,
            })

            await framer.closePlugin()
        },
    })

    useEffect(() => {
        const scrollElement = scrollRef.current

        if (scrollElement) scrollElement.scrollTop = 0
    }, [query])

    useEffect(() => {
        const scrollElement = scrollRef.current
        if (!scrollElement || isLoading) return

        const isScrollable = scrollElement.scrollHeight > scrollElement.clientHeight

        if (isScrollable || !hasNextPage) return

        void fetchNextPage()
    }, [data, hasNextPage, fetchNextPage, deferredWindowWidth, isLoading])

    const [photosColumns, columnWidth] = useMemo(() => {
        const adjustedWindowWidth = deferredWindowWidth - sidePadding
        const columnCount = Math.max(1, Math.floor((adjustedWindowWidth + columnGap) / (minColumnWidth + columnGap)))
        const columnWidth = (adjustedWindowWidth - (columnCount - 1) * columnGap) / columnCount
        const heightPerColumn = Array<number>(columnCount).fill(0)

        const seenPhotos = new Set<PhotoId>()
        const columns = Array.from({ length: columnCount }, (): UnsplashPhoto[] => [])

        if (!data) return [columns, columnWidth]

        for (const page of data.pages) {
            // TODO: Cache pages?

            for (const photo of page.results) {
                // Could have duplicates with pagination
                if (seenPhotos.has(photo.id)) continue
                seenPhotos.add(photo.id)

                const itemHeight = heightForPhoto(photo, columnWidth)

                const minColumnIndex = heightPerColumn.indexOf(Math.min(...heightPerColumn))
                if (minColumnIndex === -1) continue

                columns[minColumnIndex]?.push(photo)
                if (heightPerColumn[minColumnIndex] === undefined) throw new Error("Logic error")
                heightPerColumn[minColumnIndex] += itemHeight
            }
        }
        return [columns, columnWidth] as const
    }, [data, deferredWindowWidth])

    const isLoadingVisible = isLoading || isFetchingNextPage

    if (!isLoadingVisible && photosColumns[0]?.length === 0) {
        return <div className="flex-1 flex items-center justify-center text-tertiary">No photos found</div>
    }

    return (
        <div
            className="overflow-auto relative flex-1 rounded-[8px] mx-[15px] no-scrollbar"
            ref={scrollRef}
            onScroll={handleScroll}
        >
            <div className="relative">
                <div className="flex gap-[5px]">
                    {photosColumns.map((photos, i) => (
                        <div
                            key={`column-${i}`}
                            className="shrink-0 flex flex-col gap-[5px]"
                            style={{ width: columnWidth }}
                        >
                            {photos.map(photo => (
                                <GridItem
                                    key={photo.id}
                                    photo={photo}
                                    height={heightForPhoto(photo, columnWidth)}
                                    width={columnWidth}
                                    loading={addPhotoMutation.isPending && addPhotoMutation.variables.id === photo.id}
                                    onSelect={addPhotoMutation.mutate}
                                    isAllowedToUpsertImage={isAllowedToUpsertImage}
                                />
                            ))}
                            {isLoadingVisible && <Placeholders index={i} />}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
})

interface GridItemProps {
    photo: UnsplashPhoto
    height: number
    width: number
    loading: boolean
    onSelect: (photo: UnsplashPhoto) => void
    isAllowedToUpsertImage: boolean
}

const GridItem = memo(function GridItem({
    photo,
    loading,
    height,
    width,
    onSelect,
    isAllowedToUpsertImage,
}: GridItemProps) {
    const handleClick = useCallback(() => {
        onSelect(photo)
    }, [onSelect, photo])
    const [imageLoaded, setImageLoaded] = useState(false)

    useEffect(() => {
        const img = new Image()
        img.src = photo.urls.thumb
        img.onload = () => {
            setImageLoaded(true)
        }
    }, [photo.urls.thumb])

    return (
        <div key={photo.id} className="flex flex-col gap-[5px]">
            <Draggable
                data={{
                    type: "image",
                    image: photo.urls.full,
                    previewImage: photo.urls.thumb,
                    name: photo.alt_description ?? photo.description ?? "Unsplash Image",
                    altText: photo.alt_description ?? photo.description ?? undefined,
                }}
            >
                <button
                    onClick={() => {
                        if (!isAllowedToUpsertImage) return
                        handleClick()
                    }}
                    className="cursor-pointer bg-cover relative rounded-lg"
                    style={{
                        height,
                        backgroundImage: `url(${photo.urls.thumb})`,
                        backgroundColor: photo.color,
                    }}
                    disabled={!isAllowedToUpsertImage}
                    title={isAllowedToUpsertImage ? undefined : "Insufficient permissions"}
                >
                    <>
                        <div
                            className={cx(
                                "absolute top-0 right-0 left-0 bottom-0 rounded-lg flex items-center justify-center transition-all pointer-events-none",
                                loading && "bg-black-dimmed"
                            )}
                        >
                            {loading && <Spinner size="medium" />}
                        </div>
                        {!imageLoaded && photo.blur_hash && (
                            <div className="absolute top-0 left-0">
                                <Blurhash hash={photo.blur_hash} width={width} height={height} />
                            </div>
                        )}
                    </>
                </button>
            </Draggable>
            <a
                target="_blank"
                href={photo.user.links.html}
                className="text-2xs text-tertiary whitespace-nowrap overflow-hidden text-ellipsis"
            >
                {photo.user.name}
            </a>
        </div>
    )
})

const AppErrorBoundary = ({ children }: PropsWithChildren<object>) => (
    <QueryErrorResetBoundary>
        {({ reset }) => (
            <ErrorBoundary
                onReset={reset}
                fallbackRender={({ resetErrorBoundary }) => (
                    <div className="flex flex-1 items-center justify-center flex-col max-w-[200px] m-auto text-tertiary">
                        Could not load photos
                        <button
                            className="bg-transparent hover:bg-transparent active:bg-transparent text-blue-600 outline-hidden"
                            onClick={() => {
                                resetErrorBoundary()
                            }}
                        >
                            Try again
                        </button>
                    </div>
                )}
            >
                {children}
            </ErrorBoundary>
        )}
    </QueryErrorResetBoundary>
)

const placeholderHeights = [
    [120, 70, 90, 86],
    [70, 140, 120, 70],
    [140, 60, 70, 90],
    [90, 130, 60, 120],
]

const Placeholders = ({ index }: { index: number }) => {
    const heights = placeholderHeights[index % placeholderHeights.length]
    if (!heights) return null

    return heights.map((height, heightIndex) => (
        <div key={heightIndex} className="animate-pulse">
            <div className="bg-secondary rounded-md" style={{ height }} />
            <div className="mt-1 bg-secondary rounded-md h-[8px]" />
        </div>
    ))
}

function heightForPhoto(photo: UnsplashPhoto, columnWidth: number) {
    const ratio = photo.width / photo.height
    return columnWidth / ratio
}

function useDebounce<T>(value: T, delay: number) {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)

    useEffect(() => {
        const debounce = setTimeout(() => {
            setDebouncedValue(value)
        }, delay)

        return () => {
            clearTimeout(debounce)
        }
    }, [value, delay])

    return debouncedValue
}
