import React, { useCallback, useEffect, useRef, useState } from "react"

interface Props {
    children: React.ReactNode
    className?: string
    fadeHeight?: number
    height: number
}

export const ScrollFadeContainer = ({ children, className, fadeHeight = 45, height }: Props) => {
    const [showTopFade, setShowTopFade] = useState(false)
    const [showBottomFade, setShowBottomFade] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const scrollTimeout = useRef<NodeJS.Timeout>()

    const checkScroll = useCallback(() => {
        const element = containerRef.current
        if (!element) return

        if (scrollTimeout.current) {
            clearTimeout(scrollTimeout.current)
        }

        scrollTimeout.current = setTimeout(() => {
            requestAnimationFrame(() => {
                const { scrollTop, scrollHeight, clientHeight } = element
                const scrollBottom = scrollHeight - scrollTop - clientHeight

                setShowTopFade(scrollTop > 10)
                setShowBottomFade(scrollBottom > 10)
            })
        }, 50)
    }, [])

    useEffect(() => {
        const element = containerRef.current
        if (!element) return

        requestAnimationFrame(() => {
            const { scrollHeight, clientHeight } = element
            setShowBottomFade(scrollHeight > clientHeight)
            checkScroll()
        })

        element.addEventListener("scroll", checkScroll, { passive: true })

        return () => {
            if (scrollTimeout.current) {
                clearTimeout(scrollTimeout.current)
            }

            element.removeEventListener("scroll", checkScroll)
        }
    }, [checkScroll])

    return (
        <div className="relative w-full" style={{ height: `${height}px`, minHeight: `${height}px` }}>
            <div ref={containerRef} className={`h-full w-full overflow-y-auto no-scrollbar ${className ?? ""}`}>
                {children}
            </div>
            <div
                className="absolute top-0 left-0 right-0 z-10 pointer-events-none transition-opacity duration-300"
                style={{
                    height: fadeHeight,
                    background: "linear-gradient(to bottom, var(--framer-color-bg) 0%, transparent 100%)",
                    opacity: showTopFade ? 1 : 0,
                }}
            />
            <div
                className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none transition-opacity duration-300"
                style={{
                    height: fadeHeight,
                    background: "linear-gradient(to top, var(--framer-color-bg) 0%, transparent 100%)",
                    opacity: showBottomFade ? 1 : 0,
                }}
            />
        </div>
    )
}
