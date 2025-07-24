import { framer } from "framer-plugin"
import { AnimatePresence, type MotionProps, motion } from "motion/react"
import { cloneElement, useCallback, useEffect, useState } from "react"
import { type RouteComponentProps, useLocation, useRoute } from "wouter"
import type { BlogPluginContext } from "./blog"
import { Layout } from "./components/Layout"
import { PageErrorBoundaryFallback } from "./components/PageErrorBoundaryFallback"
import type { HubDBPluginContext } from "./hubdb"

interface PluginContexts {
    blogPluginContext: BlogPluginContext | null
    hubDbPluginContext: HubDBPluginContext | null
}

interface PluginSize {
    width?: number
    height?: number
}

export type PageProps = RouteComponentProps & PluginContexts & { goBack: () => void }

export interface Route {
    path: string
    element: React.ComponentType<PageProps>
    title?: string | (() => string)
    children?: Route[]
    showTopDivider?: boolean
    size?: PluginSize
}

interface Match {
    match: ReturnType<typeof useRoute>
    route: Route
}

interface UseRoutesProps extends PluginContexts {
    routes: Route[]
}

const DEFAULT_PLUGIN_WIDTH = 260
const DEFAULT_PLUGIN_HEIGHT = 345

function useRoutes({ routes, hubDbPluginContext, blogPluginContext }: UseRoutesProps) {
    const [location] = useLocation()
    const [animationDirection, setAnimationDirection] = useState(1)
    const [isFirstPage, setIsFirstPage] = useState(true)

    // Save the length of the `routes` array that we receive on the first render
    const [routesLen] = useState(() => routes.length)
    // because we call `useRoute` inside a loop the number of routes can't be changed
    if (routesLen !== routes.length) {
        throw new Error("The length of `routes` array provided to `useRoutes` must be constant")
    }

    useEffect(() => {
        setIsFirstPage(false)
    }, [])

    const goBack = useCallback(() => {
        setAnimationDirection(-1)
        history.back()
    }, [])

    useEffect(() => {
        setAnimationDirection(1)
    }, [location])

    const matches: Match[] = []

    const addToMatch = (route: Route, parentPath = "") => {
        const fullPath = parentPath + route.path

        // eslint-disable-next-line react-hooks/rules-of-hooks
        const match = useRoute(fullPath)
        matches.push({ match, route: { ...route, path: fullPath } })

        if (route.children) {
            for (const child of route.children) {
                addToMatch(child, fullPath)
            }
        }
    }

    for (const route of routes) {
        addToMatch(route)
    }

    for (const { match, route } of matches) {
        const [isMatch, params] = match
        const { title, showTopDivider, size, element: Element } = route

        if (!isMatch) continue

        const pageTitle = title ? (typeof title === "function" ? title() : title) : undefined

        const animationProps = isFirstPage
            ? {}
            : {
                  initial: {
                      x: `${animationDirection * 50}vw`,
                      opacity: 0,
                      position: "absolute",
                      zIndex: 2,
                  },
                  animate: {
                      x: 0,
                      opacity: 1,
                      position: "relative",
                      zIndex: 1,
                  },
                  exit: {
                      x: `${animationDirection * -30}vw`,
                      opacity: 0,
                      position: "absolute",
                      zIndex: 0,
                  },
                  transition: {
                      x: {
                          ease: [0.25, 0.1, 0.25, 1],
                          duration: 0.3,
                      },
                      opacity: {
                          duration: 0.2,
                      },
                  },
              }

        return {
            page: (
                <motion.div {...(animationProps as MotionProps)} className="w-full h-full">
                    <Layout
                        title={pageTitle}
                        animateForward={animationDirection === 1}
                        showTopDivider={showTopDivider}
                        goBack={goBack}
                    >
                        <PageErrorBoundaryFallback>
                            <Element
                                params={params}
                                hubDbPluginContext={hubDbPluginContext}
                                blogPluginContext={blogPluginContext}
                                goBack={goBack}
                            />
                        </PageErrorBoundaryFallback>
                    </Layout>
                </motion.div>
            ),
            size,
        }
    }

    return { page: <div>404. This should never happen.</div> }
}

interface RouterProps extends UseRoutesProps {
    routes: Route[]
}

/**
 * Prevents layout shifts by preserving each page's size during transitions.
 */
const SizePreserver = ({ size, children }: { size?: PluginSize; children: React.ReactNode }) => {
    return (
        <div
            style={{
                width: size?.width ?? DEFAULT_PLUGIN_WIDTH,
                height: size?.height ?? DEFAULT_PLUGIN_HEIGHT,
            }}
            className="absolute top-0 left-0 right-0 overflow-hidden"
        >
            {children}
        </div>
    )
}

export function Router({ routes, hubDbPluginContext, blogPluginContext }: RouterProps) {
    const { page, size } = useRoutes({ routes, hubDbPluginContext, blogPluginContext })

    useEffect(() => {
        void framer.showUI({
            width: size?.width ?? 260,
            height: size?.height ?? 345,
        })
    }, [size])

    return (
        <div className="relative w-full h-full overflow-hidden">
            <AnimatePresence>
                <SizePreserver size={size} key={location.pathname}>
                    {cloneElement(page, { key: location.pathname })}
                </SizePreserver>
            </AnimatePresence>
        </div>
    )
}
