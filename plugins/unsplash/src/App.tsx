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

const mode = framer.mode

const minWindowWidth = mode === "canvas" ? 260 : 600
const minColumnWidth = 100
const columnGap = 8
const sidePadding = 15 * 2

void framer.showUI({
    position: "top right",
    width: minWindowWidth,
    minWidth: minWindowWidth,
    minHeight: 400,
    resizable: false,
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
                })
                return
            }

            await framer.setImage({
                image: randomPhoto.urls.full,
                name: randomPhoto.alt_description ?? randomPhoto.description ?? "Unsplash Image",
            })

            await framer.closePlugin()
        },
    })

    return (
        <div className="container">
            <div className="search-bar">
                <input
                    type="text"
                    placeholder="Search…"
                    value={query}
                    autoFocus
                    onChange={e => setQuery(e.target.value)}
                />
                <div className="search-icon">
                    <SearchIcon />
                </div>
            </div>
            <AppErrorBoundary>
                <PhotosList query={debouncedQuery} />
            </AppErrorBoundary>
            <div className="random-button-container">
                <button
                    onClick={() => {
                        if (!isAllowedToUpsertImage) return
                        addRandomMutation.mutate(query)
                    }}
                    disabled={!isAllowedToUpsertImage}
                    title={isAllowedToUpsertImage ? undefined : "Insufficient permissions"}
                >
                    {addRandomMutation.isPending ? <div className="framer-spinner" /> : "Random Image"}
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
    const [windowSize, setWindowSize] = useState(window.innerWidth)
    const deferredWindowSize = useDeferredValue(windowSize)

    useEffect(() => {
        const handleResize = () => {
            setWindowSize(window.innerWidth)
        }

        handleResize()
        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [])

    const addPhotoMutation = useMutation({
        mutationFn: async (photo: UnsplashPhoto) => {
            const mode = framer.mode

            if (mode === "canvas") {
                await framer.addImage({
                    image: photo.urls.full,
                    name: photo.alt_description ?? photo.description ?? "Unsplash Image",
                })

                return
            }

            await framer.setImage({
                image: photo.urls.full,
                name: photo.alt_description ?? photo.description ?? "Unsplash Image",
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

        fetchNextPage()
    }, [data, hasNextPage, fetchNextPage, deferredWindowSize, isLoading])

    const [photosColumns, columnWidth] = useMemo(() => {
        const adjustedWindowSize = deferredWindowSize - sidePadding
        const columnCount = Math.max(1, Math.floor((adjustedWindowSize + columnGap) / (minColumnWidth + columnGap)))
        const columnWidth = (adjustedWindowSize - (columnCount - 1) * columnGap) / columnCount
        const heightPerColumn = Array(columnCount).fill(0)

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
                heightPerColumn[minColumnIndex] += itemHeight
            }
        }
        return [columns, columnWidth] as const
    }, [data, deferredWindowSize])

    const handleScroll = () => {
        if (isFetchingNextPage || isLoading) return

        const scrollElement = scrollRef.current
        if (!scrollElement) return

        const distanceToEnd = scrollElement.scrollHeight - (scrollElement.clientHeight + scrollElement.scrollTop)

        if (distanceToEnd > 150) return

        fetchNextPage()
    }

    const isLoadingVisible = isLoading || isFetchingNextPage

    if (!isLoadingVisible && photosColumns[0]?.length === 0) {
        return <div className="empty-state">No photos found</div>
    }

    return (
        <div className="photos-list no-scrollbar" ref={scrollRef} onScroll={handleScroll}>
            <div className="relative">
                <div className="photos-list-column-container">
                    {photosColumns.map((photos, i) => (
                        <div key={`column-${i}`} className="photos-list-column" style={{ width: columnWidth }}>
                            {photos.map(photo => (
                                <GridItem
                                    key={photo.id}
                                    photo={photo}
                                    height={heightForPhoto(photo, columnWidth)}
                                    width={columnWidth}
                                    loading={addPhotoMutation.isPending && addPhotoMutation.variables?.id === photo.id}
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
    const handleClick = useCallback(() => onSelect(photo), [onSelect, photo])
    const [imageLoaded, setImageLoaded] = useState(false)

    useEffect(() => {
        const img = new Image()
        img.src = photo.urls.thumb
        img.onload = () => setImageLoaded(true)
    }, [photo.urls.thumb])

    return (
        <div key={photo.id} className="grid-item">
            <button
                onClick={() => {
                    if (!isAllowedToUpsertImage) return
                    handleClick()
                }}
                style={{
                    height,
                    backgroundImage: `url(${photo.urls.thumb})`,
                    backgroundColor: photo.color,
                }}
                disabled={!isAllowedToUpsertImage}
                title={isAllowedToUpsertImage ? undefined : "Insufficient permissions"}
            >
                <Draggable
                    data={{
                        type: "image",
                        image: photo.urls.full,
                        previewImage: photo.urls.thumb,
                    }}
                >
                    <>
                        <div className={cx("grid-item-overlay", loading && "loading")}>
                            {loading && <div className="framer-spinner" />}
                        </div>
                        {!imageLoaded && photo.blur_hash && (
                            <div className="blur-hash-container">
                                <Blurhash hash={photo.blur_hash} width={width} height={height} />
                            </div>
                        )}
                    </>
                </Draggable>
            </button>
            <a target="_blank" href={photo.user.links.html} className="grid-item-author">
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
                    <div className="error-state">
                        Could not load photos
                        <button onClick={() => resetErrorBoundary()}>Try again</button>
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
            <div className="placeholder-image" style={{ height }} />
            <div className="placeholder-author" />
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
        const debounce = setTimeout(() => setDebouncedValue(value), delay)

        return () => {
            clearTimeout(debounce)
        }
    }, [value, delay])

    return debouncedValue
}
