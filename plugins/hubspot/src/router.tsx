import { framer } from "framer-plugin"
import { useCallback, useEffect, useState } from "react"
import { type RouteComponentProps, useRoute } from "wouter"
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
const DEFAULT_PLUGIN_HEIGHT = 352

function useRoutes({ routes, hubDbPluginContext, blogPluginContext }: UseRoutesProps) {
    // Save the length of the `routes` array that we receive on the first render
    const [routesLen] = useState(() => routes.length)
    // because we call `useRoute` inside a loop the number of routes can't be changed
    if (routesLen !== routes.length) {
        throw new Error("The length of `routes` array provided to `useRoutes` must be constant")
    }

    const goBack = useCallback(() => {
        history.back()
    }, [])

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
        const { title, size, element: Element } = route

        if (!isMatch) continue

        const pageTitle = title ? (typeof title === "function" ? title() : title) : undefined

        return {
            page: (
                <Layout title={pageTitle} goBack={goBack}>
                    <PageErrorBoundaryFallback>
                        <Element
                            params={params}
                            hubDbPluginContext={hubDbPluginContext}
                            blogPluginContext={blogPluginContext}
                            goBack={goBack}
                        />
                    </PageErrorBoundaryFallback>
                </Layout>
            ),
            size,
        }
    }

    return { page: <div>404. This should never happen.</div> }
}

interface RouterProps extends UseRoutesProps {
    routes: Route[]
}

export function Router({ routes, hubDbPluginContext, blogPluginContext }: RouterProps) {
    const { page, size } = useRoutes({ routes, hubDbPluginContext, blogPluginContext })

    useEffect(() => {
        void framer.showUI({
            width: size?.width ?? DEFAULT_PLUGIN_WIDTH,
            height: size?.height ?? DEFAULT_PLUGIN_HEIGHT,
        })
    }, [size])

    return (
        <div className="relative flex flex-col w-full h-full overflow-hidden">
            <div className="px-[15px] shrink-0">
                <hr />
            </div>
            <div className="relative flex-1 overflow-hidden">{page}</div>
        </div>
    )
}
