import {
    Suspense,
    useCallback,
    useDeferredValue,
    useMemo,
    useState,
} from "react"
import "./App.css"
import { framer } from "@framerjs/plugin-api"
import Fuse from "fuse.js"

import { IconContext } from "@phosphor-icons/react"
import * as Icons from "@phosphor-icons/react"

import {
    icons as iconData,
    IconEntry as CoreEntry,
    // @ts-expect-error - phosphor-icons is not typed
} from "@phosphor-icons/core"
import { Icon } from "@phosphor-icons/react"
import { renderToStaticMarkup } from "react-dom/server"

export const icons: ReadonlyArray<IconEntry> = iconData.map((entry: any) => ({
    ...entry,
    Icon: Icons[entry.pascal_name as keyof typeof Icons] as Icons.Icon,
}))

const fuse = new Fuse(icons, {
    keys: [
        { name: "name", weight: 4 },
        { name: "pascal_name", weight: 4 },
        "tags",
        "categories",
    ],
    threshold: 0.2, // Tweak this to what feels like the right number of results
    // shouldSort: false,
    useExtendedSearch: true,
})

export interface IconEntry extends CoreEntry {
    Icon: Icon
}

function IconGrid(props: any) {
    const { searchQuery, weight } = props

    const deferredQuery = useDeferredValue(searchQuery)

    const filteredIcons = useMemo(() => {
        const query = deferredQuery.trim().toLowerCase()
        if (!query) return icons

        return fuse.search(query).map((value) => value.item)
    }, [deferredQuery])

    const handleIconClick = useCallback(async (entry: IconEntry) => {
        const { Icon } = entry

        const svg = renderToStaticMarkup(
            <Icon size={32} color={"black"} weight={weight} />
        )

        await framer.addSVG({
            svg,
            name: "test.svg",
        })
    }, [])

    return (
        <div className="grid">
            {filteredIcons.map((entry) => {
                const { Icon } = entry

                return (
                    <div
                        key={entry.Icon.name}
                        className="icon-parent"
                        onClick={() => handleIconClick(entry)}
                    >
                        <Icon size={32} color={"black"} weight={weight} />
                    </div>
                )
            })}
        </div>
    )
}

export function App() {
    const weight = "regular"
    const [searchQuery, setSearchQuery] = useState("")

    return (
        <>
            <div className="divider" />
            <div className="search-parent">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                    <path
                        fill="currentColor"
                        d="M7.5 2a5.5 5.5 0 0 1 4.383 8.823l1.885 1.884a.75.75 0 1 1-1.061 1.061l-1.884-1.885A5.5 5.5 0 1 1 7.5 2Zm-4 5.5a4 4 0 1 0 8 0 4 4 0 0 0-8 0Z"
                    ></path>
                </svg>
                <input
                    autoComplete="nope"
                    autoCorrect="off"
                    className="search-input"
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search…"
                />
            </div>
            <div className="divider" />
            <Suspense fallback={null}>
                <IconContext.Provider value={{ size: 32, weight }}>
                    <IconGrid searchQuery={searchQuery} weight={weight} />
                </IconContext.Provider>
            </Suspense>
        </>
    )
}
