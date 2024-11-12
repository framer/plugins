import { cloneElement, useEffect, useState } from "react"
import { RouteComponentProps, useLocation, useRoute } from "wouter"
import { AnimatePresence, MotionProps, motion } from "framer-motion"
import { PageErrorBoundaryFallback } from "./components/PageErrorBoundaryFallback"
import { Layout } from "./components/Layout"
import { HubDBPluginContext } from "./hubdb"
import { BlogPluginContext } from "./blog"

interface PluginContexts {
    blogPluginContext: BlogPluginContext | null
    hubDBPluginContext: HubDBPluginContext | null
}

export type PageProps = RouteComponentProps & PluginContexts

export interface Route {
    path: string
    element: React.ComponentType<PageProps>
    title?: string | (() => string)
    children?: Route[]
    showTopDivider?: boolean
}

interface Match {
    match: ReturnType<typeof useRoute>
    route: Route
}

interface UseRoutesProps extends PluginContexts {
    routes: Route[]
}

function useRoutes({ routes, hubDBPluginContext, blogPluginContext }: UseRoutesProps) {
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

    useEffect(() => {
        const originalHistoryBack = history.back

        history.back = () => {
            setAnimationDirection(-1)
            originalHistoryBack.call(history)
        }

        return () => {
            history.back = originalHistoryBack
        }
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
        const { title, showTopDivider, element: Element } = route

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

        return (
            <motion.div {...(animationProps as MotionProps)}>
                <Layout title={pageTitle} animateForward={animationDirection === 1} showTopDivider={showTopDivider}>
                    <PageErrorBoundaryFallback>
                        <Element
                            params={params}
                            hubDBPluginContext={hubDBPluginContext}
                            blogPluginContext={blogPluginContext}
                        />
                    </PageErrorBoundaryFallback>
                </Layout>
            </motion.div>
        )
    }

    return <div>404. This should never happen.</div>
}

interface RouterProps extends UseRoutesProps {
    routes: Route[]
}

export function Router({ routes, hubDBPluginContext, blogPluginContext }: RouterProps) {
    const page = useRoutes({ routes, hubDBPluginContext, blogPluginContext })

    return <AnimatePresence>{page && cloneElement(page, { key: location.pathname })}</AnimatePresence>
}
