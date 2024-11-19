import { framer } from "framer-plugin"
import { useEffect, useState } from "react"
import { useLocation } from "wouter"
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
import { getHubDBPluginContext, HubDBPluginContext, shouldSyncHubDBImmediately, syncHubDBTable } from "./hubdb"

const routes: Route[] = [
    {
        path: "/",
        element: AuthPage,
    },
    {
        path: "/canvas",
        element: CanvasMenuPage,
        size: {
            height: 546,
        },
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
                size: {
                    height: 197,
                },
            },
            {
                path: "/chat",
                element: ChatPage,
                title: "Chat",
                size: {
                    height: 380,
                },
            },
            {
                path: "/forms",
                element: FormsPage,
                title: "Forms",
                children: [
                    {
                        path: "/installation",
                        element: FormsInstallationPage,
                        size: {
                            height: 263,
                        },
                    },
                ],
            },
            {
                path: "/tracking",
                element: TrackingPage,
                title: "Tracking",
                size: {
                    height: 172,
                },
                children: [
                    {
                        path: "/learn-more",
                        element: LearnMoreTrackingPage,
                        size: {
                            height: 184,
                        },
                    },
                ],
            },
        ],
    },
    {
        path: "/cms",
        element: CMSMenuPage,
        size: {
            height: 141,
        },
        children: [
            {
                path: "/blog",
                element: BlogPage,
                size: {
                    width: 340,
                    height: 425,
                },
            },
            {
                path: "/hubdb",
                element: HubDBPage,
                showTopDivider: false,
                size: {
                    width: 320,
                    height: 305,
                },
                children: [
                    {
                        path: "/map",
                        element: MapHubDBFieldsPage,
                        size: {
                            width: 340,
                            height: 425,
                        },
                    },
                ],
            },
        ],
    },
]

export function App() {
    const [hubDbPluginContext, setHubDBPluginContext] = useState<HubDBPluginContext | null>(null)
    const [blogPluginContext, setBlogPluginContext] = useState<BlogPluginContext | null>(null)
    const [, navigate] = useLocation()
    const [isLoading, setIsLoading] = useState(true)

    const isAuthenticated = auth.isAuthenticated()

    useEffect(() => {
        const mode = framer.mode

        async function handleCMSModes() {
            const mode = framer.mode
            const blogContext = await getBlogPluginContext()
            const hubContext = await getHubDBPluginContext()

            setBlogPluginContext(blogContext)
            setHubDBPluginContext(hubContext)

            const shouldSyncBlog = mode === "syncManagedCollection" && shouldSyncBlogImmediately(blogContext)
            const shouldSyncHubDB = mode === "syncManagedCollection" && shouldSyncHubDBImmediately(hubContext)

            if (shouldSyncBlog) {
                return syncBlogs({
                    includedFieldIds: blogContext.includedFieldIds,
                    fields: blogContext.collectionFields,
                }).then(() => framer.closePlugin("Synchronization successful"))
            }

            if (shouldSyncHubDB) {
                return syncHubDBTable({
                    tableId: hubContext.tableId,
                    fields: hubContext.collectionFields,
                    slugFieldId: hubContext.slugFieldId,
                    includedFieldIds: hubContext.includedFieldIds,
                }).then(() => framer.closePlugin("Synchronization successful"))
            }

            if (blogContext.type === "update") {
                navigate("/cms/blog")
                return
            }

            if (hubContext.type === "update") {
                navigate(`/cms/hubdb/map?tableId=${hubContext.tableId}`)
                return
            }

            // New collection
            navigate("/cms")
        }

        async function getContexts() {
            const isInCMSModes = mode === "syncManagedCollection" || mode === "configureManagedCollection"

            if (!isAuthenticated) {
                navigate("/")
                return
            }

            if (isInCMSModes) {
                return handleCMSModes()
            }

            navigate("/canvas")
        }

        getContexts()
            .then(() => setIsLoading(false))
            .catch(e => framer.closePlugin(e instanceof Error ? e.message : "Unknown error", { variant: "error" }))
    }, [navigate, isAuthenticated])

    if (isLoading) return null

    return (
        <div className="w-full h-full">
            <Router routes={routes} blogPluginContext={blogPluginContext} hubDbPluginContext={hubDbPluginContext} />
        </div>
    )
}
