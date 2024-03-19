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

import { IconContext, IconWeight } from "@phosphor-icons/react"
import * as Icons from "@phosphor-icons/react"

// @ts-expect-error - Phosphor has type issues
import { icons as iconData } from "@phosphor-icons/core"
import { Icon } from "@phosphor-icons/react"
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

type WeightOption = { key: string; value: IconWeight }

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

function IconGrid(props: any) {
  const { searchQuery, weight } = props

  const deferredQuery = useDeferredValue(searchQuery)

  const filteredIcons = useMemo(() => {
    const query = deferredQuery.trim().toLowerCase()
    if (!query) return icons

    return fuse.search(query).map((value) => value.item)
  }, [deferredQuery])

  const handleIconClick = useCallback(
    async (entry: IconEntry) => {
      const { Icon } = entry

      const svg = renderToStaticMarkup(
        <Icon size={32} color={"black"} weight={weight} />
      )

      await framer.addSVG({
        svg,
        name: "test.svg",
      })
    },
    [weight]
  )

  return (
    <div className="grid">
      {filteredIcons.map((entry: IconEntry) => {
        const { Icon } = entry

        return (
          <div
            key={entry.name}
            className="icon-parent"
            onClick={() => handleIconClick(entry)}
          >
            <Icon
              size={32}
              color={"var(--framer-color-text)"}
              weight={weight}
            />
          </div>
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
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search…"
        />
        <select
          className="weight-selector"
          value={weight}
          onChange={(e) => {
            setWeight(e.target.value as IconWeight)
          }}
        >
          {weightOptions.map((option) => (
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
