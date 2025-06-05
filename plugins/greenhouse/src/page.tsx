import { framer } from "framer-plugin"
import { useEffect, useRef } from "react"

export default function Page({
    children,
    onPreviousPage,
    previousPage,
    width = 360,
}: {
    children: React.ReactNode
    onPreviousPage?: () => void
    previousPage?: string
    width?: number
}) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!ref.current) return

        const observer = new ResizeObserver(entries => {
            const { height } = entries[0].contentRect

            framer.showUI({
                maxHeight: 477,
                height,
                width,
                resizable: true,
            })
        })

        observer.observe(ref.current)

        return () => {
            observer.disconnect()
        }
    }, [width])

    return (
        <div ref={ref}>
            <main>
                {previousPage && (
                    <>
                        <hr className="sticky-divider" />
                        <a onClick={() => onPreviousPage?.()} className="previous-page">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12">
                                <path
                                    d="M 5 2 L 1.5 6 L 5 9.5"
                                    fill="transparent"
                                    strokeWidth="1.5"
                                    stroke="rgb(153,153,153)"
                                    strokeLinecap="round"
                                    strokeMiterlimit="10"
                                    strokeDasharray=""
                                ></path>
                            </svg>
                            {previousPage}
                        </a>
                        <hr className="sticky-divider" />
                    </>
                )}

                {children}
            </main>
        </div>
    )
}
