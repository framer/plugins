import { framer, type UIOptions } from "framer-plugin"
import { createContext, type ReactNode, useContext, useMemo, useState } from "react"

type Route =
    | {
          uid: "home"
          opts: undefined
      }
    | {
          uid: "select-file"
          opts: undefined
      }
    | {
          uid: "field-mapping"
          opts: undefined
      }
    | {
          uid: "manage-conflicts"
          opts: undefined
      }

const fallbackUiOptions: UIOptions = { width: 260, height: 330, resizable: false }
const defaultUiOptions = {
    home: fallbackUiOptions,
    "field-mapping": { width: 400, height: 600, resizable: true },
    "manage-conflicts": { width: 260, height: 165, resizable: false },
} as Record<Route["uid"], UIOptions | undefined>

interface MiniRouterContextType {
    // Define your context properties here
    currentRoute: Route
    navigate: (route: Route) => Promise<void>
}

const MiniRouterContext = createContext<MiniRouterContextType | undefined>(undefined)

interface MiniRouterProviderProps {
    children: ReactNode
}

export function MiniRouterProvider({ children }: MiniRouterProviderProps) {
    const [currentRoute, setCurrentRoute] = useState<Route>({ uid: "home", opts: undefined })

    const value: MiniRouterContextType = useMemo(() => {
        return {
            currentRoute,
            navigate: async route => {
                const uiOptions = defaultUiOptions[route.uid] ?? fallbackUiOptions
                await framer.showUI(uiOptions)

                setCurrentRoute(route)
            },
        }
    }, [currentRoute])

    return <MiniRouterContext.Provider value={value}>{children}</MiniRouterContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useMiniRouter = () => {
    const context = useContext(MiniRouterContext)
    if (context === undefined) {
        throw new Error("useMiniRouter must be used within a MiniRouterProvider")
    }
    return context
}
