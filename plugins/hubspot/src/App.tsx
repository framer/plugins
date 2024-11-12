import { framer } from "framer-plugin"
import { useEffect, useRef, useState } from "react"
import { useDebounceCallback, useResizeObserver } from "usehooks-ts"
import { Route, Router } from "./router"
import auth from "./auth"
import AuthPage from "./pages/Auth"
import {
    CanvasMenuPage,
    MeetingsPage,
    AccountPage,
    ChatPage,
    FormsPage,
    FormsInstallationPage,
    TrackingPage,
    LearnMoreTrackingPage,
} from "./pages/canvas"
import { CMSMenuPage, BlogPage, MapHubDBFieldsPage, HubDBPage } from "./pages/cms"
import { BlogPluginContext, getBlogPluginContext, shouldSyncBlogImmediately, syncBlogs } from "./blog"
import { useLocation } from "wouter"
import { getHubDBPluginContext, HubDBPluginContext, shouldSyncHubDBImmediately, syncHubDBTable } from "./hubdb"

interface Size {
    width?: number
    height?: number
}

const routes: Route[] = [
    {
        path: "/",
        element: AuthPage,
    },
    {
        path: "/canvas",
        element: CanvasMenuPage,
        children: [
            {
                path: "/meetings",
                element: MeetingsPage,
                title: "Meetings",
            },
            {
                path: "/account",
                element: AccountPage,
                title: "Account",
            },
            {
                path: "/chat",
                element: ChatPage,
                title: "Chat",
            },
            {
                path: "/forms",
                element: FormsPage,
                title: "Forms",
                children: [
                    {
                        path: "/installation",
                        element: FormsInstallationPage,
                    },
                ],
            },
            {
                path: "/tracking",
                element: TrackingPage,
                title: "Tracking",
                children: [
                    {
                        path: "/learn-more",
                        element: LearnMoreTrackingPage,
                    },
                ],
            },
        ],
    },
    {
        path: "/cms",
        element: CMSMenuPage,
        children: [
            {
                path: "/blog",
                element: BlogPage,
            },
            {
                path: "/hubdb",
                element: HubDBPage,
                showTopDivider: false,
                children: [
                    {
                        path: "/map",
                        element: MapHubDBFieldsPage,
                    },
                ],
            },
        ],
    },
]

export function App() {
    const [isLoading, setIsLoading] = useState(true)
    const [hubDBPluginContext, setHubDBPluginContext] = useState<HubDBPluginContext | null>(null)
    const [blogPluginContext, setBlogPluginContext] = useState<BlogPluginContext | null>(null)

    const [, navigate] = useLocation()

    const ref = useRef(null)
    const [{ width, height }, setSize] = useState<Size>({})
    const onResize = useDebounceCallback(setSize, 10)

    useResizeObserver({
        ref,
        onResize,
    })

    useEffect(() => {
        console.log(width, height)
        if (!width || !height) return
        framer.showUI({
            position: "top right",
            height,
            width,
        })
    }, [width, height, ref, isLoading])

    useEffect(() => {
        const mode = framer.mode

        const handleNotAuthenticated = () => {
            setSize({ width: 260, height: 315 })
        }

        const handleNewCollection = () => {
            navigate("/cms")
            setSize({ width: 260, height: 141 })
        }

        async function handleCMSModes(
            blogContext: BlogPluginContext,
            hubContext: HubDBPluginContext,
            isAuthenticated: boolean
        ) {
            setBlogPluginContext(blogContext)
            setHubDBPluginContext(hubContext)

            if (!isAuthenticated) {
                handleNotAuthenticated()
                return
            }

            if (mode === "syncManagedCollection") {
                if (shouldSyncBlogImmediately(blogContext)) {
                    return syncBlogs({
                        includedFieldIds: blogContext.includedFieldIds,
                        fields: blogContext.collectionFields,
                    }).then(() => framer.closePlugin("Synchronization successful"))
                }

                if (shouldSyncHubDBImmediately(hubContext)) {
                    return syncHubDBTable({
                        tableId: hubContext.tableId,
                        fields: hubContext.collectionFields,
                        slugFieldName: hubContext.slugFieldName,
                        includedFieldNames: hubContext.includedFieldNames,
                    }).then(() => framer.closePlugin("Synchronization successful"))
                }

                handleNewCollection()

                return
            }

            if (blogContext.type === "update") {
                navigate("/cms/blog")
                setSize({ width: 340, height: 441 })
                return
            }

            if (hubContext.type === "update") {
                navigate(`/cms/hubdb/map?tableId=${hubContext.tableId}`)
                setSize({ width: 340, height: 447 })
                return
            }

            handleNewCollection()
        }

        async function getContexts() {
            const isAuthenticated = auth.isAuthenticated()
            const isInCMSModes = mode === "syncManagedCollection" || mode === "configureManagedCollection"

            if (isInCMSModes) {
                const blogContext = await getBlogPluginContext()
                const hubContext = await getHubDBPluginContext()
                await handleCMSModes(blogContext, hubContext, isAuthenticated)
                return
            }

            if (!isAuthenticated) {
                handleNotAuthenticated()
                return
            }

            navigate("/canvas")
            setSize({ width: 260, height: 546 })
        }

        getContexts()
            .then(() => setIsLoading(false))
            .catch(e => framer.notify(e instanceof Error ? e.message : "Unknown error", { variant: "error" }))
    }, [navigate])

    return (
        <main ref={ref} className="w-fit h-fit">
            {!isLoading && (
                <Router routes={routes} blogPluginContext={blogPluginContext} hubDBPluginContext={hubDBPluginContext} />
            )}
        </main>
    )
}
