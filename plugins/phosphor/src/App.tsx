import { Draggable, framer, useIsAllowedTo } from "framer-plugin"
import Fuse from "fuse.js"
import { Suspense, useCallback, useDeferredValue, useMemo, useState } from "react"
import "./App.css"

import { icons as iconData } from "@phosphor-icons/core"
import * as Icons from "@phosphor-icons/react"
import { type Icon, IconContext, type IconWeight } from "@phosphor-icons/react"
import { renderToStaticMarkup } from "react-dom/server"

interface IconEntry {
    name: string // "cloud-lightning"
    pascal_name: string // "CloudLightning"
    alias?: {
        name: string
        pascal_name: string
    }
    Icon: Icon
    codepoint: number
    categories: readonly string[] // ["weather"]
    tags: readonly string[] // ["*updated*", "meteorology", "thunderstorm"]
    published_in: number // 1.0
    updated_in: number // 1.4
}

interface WeightOption {
    key: string
    value: IconWeight
}

const weightOptions: WeightOption[] = [
    {
        key: "Thin",
        value: "thin",
    },
    {
        key: "Light",
        value: "light",
    },
    {
        key: "Regular",
        value: "regular",
    },
    {
        key: "Bold",
        value: "bold",
    },
    {
        key: "Fill",
        value: "fill",
    },
    {
        key: "Duotone",
        value: "duotone",
    },
]

const icons: readonly IconEntry[] = iconData.map(entry => ({
    ...entry,
    Icon: Icons[entry.pascal_name as keyof typeof Icons] as Icons.Icon,
}))

const fuse = new Fuse(icons, {
    keys: [{ name: "name", weight: 4 }, { name: "pascal_name", weight: 4 }, "tags", "categories"],
    threshold: 0.2, // Tweak this to what feels like the right number of results
    useExtendedSearch: true,
})

function IconGrid(props: { searchQuery: string; weight: IconWeight }) {
    const { searchQuery, weight } = props

    const isAllowedToAddSVG = useIsAllowedTo("addSVG")

    const deferredQuery = useDeferredValue(searchQuery)

    const filteredIcons = useMemo(() => {
        const query = deferredQuery.trim().toLowerCase()
        if (!query) return icons

        return fuse.search(query).map(value => value.item)
    }, [deferredQuery])

    const handleIconClick = useCallback(
        async (entry: IconEntry) => {
            const { Icon } = entry

            const svg = renderToStaticMarkup(<Icon size={32} color={"black"} weight={weight} />)

            await framer.addSVG({
                svg,
                name: "Icon",
            })
        },
        [weight]
    )

    if (filteredIcons.length === 0) {
        return (
            <div className="error-container">
                <p>No Results</p>
            </div>
        )
    }

    return (
        <div className="grid">
            {filteredIcons.map((entry: IconEntry) => {
                const { Icon } = entry

                return (
                    <button
                        className="icon-parent"
                        onClick={() => {
                            if (!isAllowedToAddSVG) return
                            void handleIconClick(entry)
                        }}
                        disabled={!isAllowedToAddSVG}
                        title={isAllowedToAddSVG ? undefined : "Insufficient permissions"}
                    >
                        <Draggable
                            data={() => ({
                                type: "svg",
                                name: "Icon",
                                svg: renderToStaticMarkup(<Icon size={32} color={"black"} weight={weight} />),
                            })}
                            key={entry.name}
                        >
                            <Icon size={32} color={"var(--framer-color-text)"} weight={weight} />
                        </Draggable>
                    </button>
                )
            })}
        </div>
    )
}

export function App() {
    const [weight, setWeight] = useState<IconWeight>("regular")
    const [searchQuery, setSearchQuery] = useState("")

    return (
        <>
            <div className="search-container">
                <input
                    autoComplete="nope"
                    autoCorrect="off"
                    autoFocus
                    className="search-input"
                    onChange={e => {
                        setSearchQuery(e.target.value)
                    }}
                    placeholder="Search…"
                />
                <select
                    className="weight-selector"
                    value={weight}
                    onChange={e => {
                        setWeight(e.target.value as IconWeight)
                    }}
                >
                    {weightOptions.map(option => (
                        <option key={option.key} value={option.value}>
                            {option.key}
                        </option>
                    ))}
                </select>
            </div>

            <div className="grid-container">
                <Suspense fallback={null}>
                    <IconContext.Provider value={{ size: 32, weight }}>
                        <IconGrid searchQuery={searchQuery} weight={weight} />
                    </IconContext.Provider>
                </Suspense>
            </div>
        </>
    )
}
