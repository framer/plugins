import { framer, type UIOptions } from "framer-plugin"
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { ImportResult } from "./utils/csv"
import type { InferredField } from "./utils/typeInference"

type Route =
    | {
          uid: "home"
          opts: undefined
      }
    | {
          uid: "field-mapping"
          opts: {
              csvRecords: Record<string, string>[]
              inferredFields: InferredField[]
          }
      }
    | {
          uid: "manage-conflicts"
          opts: {
              conflicts: ImportResult["items"]
              result: ImportResult
          }
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

    useEffect(() => {
        const uiOptions = defaultUiOptions[currentRoute.uid] ?? fallbackUiOptions
        void framer.showUI(uiOptions)
    }, [currentRoute.uid])

    // eslint-disable-next-line @typescript-eslint/require-await -- async for forward compatibility
    const navigate = useCallback(async (route: Route) => {
        setCurrentRoute(route)
    }, [])

    const value: MiniRouterContextType = useMemo(() => {
        return {
            currentRoute,
            navigate,
        }
    }, [currentRoute, navigate])

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
