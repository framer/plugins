import { Draggable, framer, useIsAllowedTo } from "framer-plugin"
import { useCallback, useMemo, useState } from "react"
import buttonImage from "./assets/Button.png"
import sectionFAQImage from "./assets/FAQ.png"
import sectionFeaturesLargeImage from "./assets/Features.png"
import sectionHeaderImage from "./assets/Header.png"
import sectionImageTextImage from "./assets/ImageText.png"
import sectionPivotImage from "./assets/Pivot.png"
import sectionPricingImage from "./assets/Pricing.png"
import { SearchIcon } from "./assets/SearchIcon"
import tabsImage from "./assets/Tabs.png"
import sectionTextImageImage from "./assets/TextImage.png"

import "./App.css"
import { SegmentedControl } from "./components/SegmentedControl"

void framer.showUI({
    position: "top right",
    width: 320,
    height: 500,
})

interface SectionItem {
    image: string
    url: string
    title: string
    key: string
}

const layoutSectionItems: SectionItem[] = [
    {
        key: "header section",
        title: "Header",
        image: sectionHeaderImage,
        url: "https://framer.com/m/framer/Section-Header.js",
    },
    {
        key: "text image",
        title: "Text and Image",
        image: sectionTextImageImage,
        url: "https://framer.com/m/framer/section-text-image.js",
    },
    {
        key: "image text",
        title: "Image and Text",
        image: sectionImageTextImage,
        url: "https://framer.com/m/framer/section-image-text.js",
    },
    {
        key: "feature section 2",
        title: "Features Large",
        image: sectionFeaturesLargeImage,
        url: "https://framer.com/m/framer/section-features-large.js",
    },
    {
        key: "pricing section",
        title: "Pricing",
        image: sectionPricingImage,
        url: "https://framer.com/m/framer/Section-Pricing.js",
    },
    {
        key: "faq section",
        title: "FAQ",
        image: sectionFAQImage,
        url: "https://framer.com/m/framer/Section-FAQ.js",
    },
    {
        key: "pivot section",
        title: "Pivot",
        image: sectionPivotImage,
        url: "https://framer.com/m/framer/Section-Pivot.js",
    },
]

interface Color {
    title: string
    color: string
}

const componentItems = [
    {
        key: "button",
        title: "Button",
        image: buttonImage,
        url: "https://framer.com/m/Button-vh3D.js",
    },
    {
        key: "tabs",
        title: "Tabs",
        image: tabsImage,
        url: "https://framer.com/m/Tabs-Afuw.js",
    },
]

const colors: Color[] = [
    {
        title: "Backdrop",
        color: "#111",
    },
    {
        title: "Text",
        color: "#fff",
    },
    {
        title: "Grape",
        color: "#6655FF",
    },
    {
        title: "Sea",
        color: "#38E",
    },
    {
        title: "Sky",
        color: "#38AAFF",
    },
    {
        title: "Mint",
        color: "#56DEDD",
    },
    {
        title: "Honey",
        color: "#FBDD45",
    },
]

function getPermissionTitle(isAllowed: boolean) {
    return isAllowed ? undefined : "Insufficient permissions"
}

export function App() {
    const [search, setSearch] = useState("")
    const [activeTab, setActiveTab] = useState("components")

    const isAllowedToAddDetachedComponentLayers = useIsAllowedTo("addDetachedComponentLayers")
    const isAllowedToUpsertColorStyle = useIsAllowedTo("createColorStyle", "ColorStyle.setAttributes")

    const filteredLayoutItems = useMemo(() => {
        return layoutSectionItems.filter(item => item.title.toLowerCase().includes(search.toLowerCase()))
    }, [search])

    const filteredComponentItems = useMemo(() => {
        return componentItems.filter(item => item.title.toLowerCase().includes(search.toLowerCase()))
    }, [search])

    const filteredColorItems = useMemo(() => {
        return colors.filter(item => item.title.toLowerCase().includes(search.toLowerCase()))
    }, [search])

    const handleAddColors = useCallback(
        async (colors: Color[]) => {
            if (!isAllowedToUpsertColorStyle) return
            const colorStyles = await framer.getColorStyles()

            colors.forEach(color => {
                const existingStyle = colorStyles.find(style => style.name === color.title)

                if (existingStyle) {
                    void existingStyle.setAttributes({
                        light: color.color,
                    })
                } else {
                    void framer.createColorStyle({
                        name: color.title,
                        light: color.color,
                    })
                }
            })
        },
        [isAllowedToUpsertColorStyle]
    )

    const hasNoResults = () => {
        if (activeTab === "components") return filteredComponentItems.length === 0
        if (activeTab === "layouts") return filteredLayoutItems.length === 0
        if (activeTab === "styles") return filteredColorItems.length === 0
        return false
    }

    return (
        <main>
            <div className="search-container">
                <SearchIcon />
                <input
                    autoFocus
                    type="search"
                    placeholder="Search…"
                    className="search-input"
                    onChange={e => {
                        setSearch(e.target.value)
                    }}
                    value={search}
                />
                <SegmentedControl
                    value={activeTab}
                    onChange={value => {
                        setActiveTab(value)
                    }}
                    items={[
                        { value: "components", label: "Components" },
                        { value: "layouts", label: "Layouts" },
                        { value: "styles", label: "Styles" },
                    ]}
                />
            </div>

            {hasNoResults() && (
                <div className="no-results">
                    <span>No results</span>
                </div>
            )}

            <div className="contents-container">
                {activeTab === "components" && (
                    <>
                        <div className="contents-column">
                            {filteredComponentItems.map(section => (
                                <button
                                    className="section-button"
                                    key={section.key}
                                    disabled={!isAllowedToAddDetachedComponentLayers}
                                    title={
                                        isAllowedToAddDetachedComponentLayers ? undefined : "Insufficient permissions"
                                    }
                                    onClick={() => {
                                        if (!isAllowedToAddDetachedComponentLayers) return
                                        void framer.addDetachedComponentLayers({
                                            url: section.url,
                                            layout: true,
                                        })
                                    }}
                                >
                                    <Draggable
                                        data={{
                                            type: "detachedComponentLayers",
                                            url: section.url,
                                            previewImage: section.image,
                                            layout: true,
                                        }}
                                    >
                                        <div className="section-inner-container">
                                            <div className="section-image">
                                                <img src={section.image} alt={section.title} />
                                            </div>
                                        </div>
                                    </Draggable>
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {activeTab === "layouts" && (
                    <>
                        {filteredLayoutItems.map(section => (
                            <button
                                key={section.key}
                                className="section-button"
                                disabled={!isAllowedToAddDetachedComponentLayers}
                                title={isAllowedToAddDetachedComponentLayers ? undefined : "Insufficient permissions"}
                                onClick={() => {
                                    if (!isAllowedToAddDetachedComponentLayers) return
                                    void framer.addDetachedComponentLayers({
                                        url: section.url,
                                        layout: true,
                                    })
                                }}
                            >
                                <Draggable
                                    data={{
                                        type: "detachedComponentLayers",
                                        url: section.url,
                                        previewImage: section.image,
                                        layout: true,
                                    }}
                                >
                                    <div className="section-container layout-section">
                                        <div className="section-image">
                                            <img src={section.image} alt={section.title} />
                                        </div>
                                    </div>
                                </Draggable>
                            </button>
                        ))}
                    </>
                )}
                {activeTab === "styles" && (
                    <div className="contents-column">
                        {filteredColorItems.map((color, index) => (
                            <div className="color-container" key={index}>
                                <div
                                    className="color-box"
                                    style={{
                                        backgroundColor: color.color,
                                    }}
                                />
                                <div className="color-label">{color.title}</div>
                                <button
                                    className="copy-button"
                                    disabled={!isAllowedToUpsertColorStyle}
                                    title={getPermissionTitle(isAllowedToUpsertColorStyle)}
                                    onClick={() => {
                                        void handleAddColors([color])
                                    }}
                                >
                                    Add
                                </button>
                            </div>
                        ))}
                        <button
                            className="action-button"
                            disabled={!isAllowedToUpsertColorStyle}
                            title={getPermissionTitle(isAllowedToUpsertColorStyle)}
                            onClick={() => {
                                void handleAddColors(filteredColorItems)
                            }}
                        >
                            Add to Project
                        </button>
                    </div>
                )}
            </div>
        </main>
    )
}
