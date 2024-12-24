import { framer } from "framer-plugin"
import { useEffect, useState } from "react"
import { useLocation } from "wouter"
import { Router, Route } from "./router"
import { getPluginContext, PluginContext, shouldSyncImmediately, syncAllRecords } from "./cms"
import { assert } from "./utils"
import auth from "./auth"
import {
    Account,
    AccountEngagementForms,
    AccountEngagementFormHandlers,
    Auth,
    BusinessUnitId,
    Messaging,
    Sync,
    Menu,
    ObjectSearch,
    Tracking,
    TrackingMID,
    WebForm,
    WebFormFields,
    DomainConnection,
} from "./pages"

const routes: Route[] = [
    {
        path: "/",
        element: Auth,
    },
    {
        path: "/business-unit-id",
        element: BusinessUnitId,
    },
    {
        path: "/menu",
        element: Menu,
        size: {
            height: 530,
        },
    },
    {
        path: "/account",
        element: Account,
        title: "Account",
        size: {
            height: 459,
        },
        children: [
            {
                path: "/domain-connection",
                element: DomainConnection,
                title: "Domain Connection",
                size: {
                    height: 190,
                },
            },
        ],
    },
    {
        path: "/messaging",
        element: Messaging,
        title: "Messaging",
        size: {
            height: 361,
        },
    },
    {
        path: "/web-form",
        element: WebForm,
        title: () => `${history.state.title} Form`,
        size: {
            height: 233,
        },
        children: [
            {
                path: "/fields",
                element: WebFormFields,
                title: () => `${history.state.title} Fields`,
                size: {
                    height: 387,
                },
            },
        ],
    },
    {
        path: "/account-engagement-forms",
        title: "Account Engagement Forms",
        element: AccountEngagementForms,
        children: [
            {
                path: "/handlers",
                element: AccountEngagementFormHandlers,
                title: "Form Handlers",
            },
        ],
    },
    {
        path: "/object-search",
        element: ObjectSearch,
        title: () => history.state?.title,
        size: {
            height: 400,
        },
    },
    {
        path: "/tracking",
        title: "Tracking",
        element: Tracking,
        size: {
            height: 170,
        },
        children: [
            {
                path: "/mid",
                element: TrackingMID,
                title: "Tracking MID",
                size: {
                    height: 215,
                },
            },
        ],
    },
    {
        path: "/sync",
        element: Sync,
        size: {
            width: 340,
            height: 425,
        },
    },
]

export function App() {
    const [, navigate] = useLocation()
    const [isLoading, setIsLoading] = useState(true)
    const [pluginContext, setPluginContext] = useState<PluginContext | null>(null)

    const isAuthenticated = auth.isAuthenticated()

    useEffect(() => {
        const mode = framer.mode
        const isInCMSModes = mode === "syncManagedCollection" || mode === "configureManagedCollection"

        async function handleCMSModes() {
            const context = await getPluginContext()
            const shouldSync = shouldSyncImmediately(context) && mode === "syncManagedCollection"

            setPluginContext(context)

            if (context.type === "update") {
                const { objectId, objectLabel, includedFieldIds, collectionFields, slugFieldId, fieldConfigs } = context

                if (shouldSync) {
                    assert(slugFieldId)

                    return syncAllRecords({
                        objectId,
                        objectLabel,
                        fields: collectionFields,
                        includedFieldIds,
                        slugFieldId,
                        fieldConfigs,
                        onProgress: () => {
                            // TODO: Progress indicator.
                        },
                    }).then(() => framer.closePlugin())
                }

                // Manage collection
                navigate(`/sync?objectName=${objectId}&objectLabel=${objectLabel}`)
                return
            }

            // Create collection
            navigate("/object-search?redirect=/sync")
        }

        async function getContext() {
            if (!isAuthenticated) {
                navigate("/")
                return
            }

            if (isInCMSModes) {
                return handleCMSModes()
            }

            const businessUnitId = auth.getBusinessUnitId()

            // Authenticated but has not completed the setup
            if (businessUnitId === null) {
                navigate("/business-unit-id")
                return
            }

            navigate("/menu")
        }

        getContext()
            .then(() => setIsLoading(false))
            .catch(e => framer.closePlugin(e instanceof Error ? e.message : "Unknown error", { variant: "error" }))
    }, [isAuthenticated, navigate])

    if (isLoading) return null

    return (
        <div className="w-full h-full">
            <Router routes={routes} pluginContext={pluginContext} />
        </div>
    )
}
