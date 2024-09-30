import { framer, Draggable } from "framer-plugin"

import sectionContactImage from "./images/Contact.png"
import sectionFAQImage from "./images/FAQ.png"
import sectionFeatureCardsImage from "./images/FeatureCards.png"
import sectionFeaturesImage from "./images/Features.png"
import sectionFeaturesLargeImage from "./images/Features2.png"
import sectionGrid1Image from "./images/Grid1.png"
import sectionGrid2Image from "./images/Grid2.png"
import sectionHeaderImage from "./images/Header.png"
import sectionHeaderBackgroundImage from "./images/HeaderBackground.png"
import sectionImageTextImage from "./images/ImageText.png"
import sectionLogosImage from "./images/Logos.png"
import sectionPivotImage from "./images/Pivot.png"
import sectionPricingImage from "./images/Pricing.png"
import sectionTemplatesImage from "./images/Templates.png"
import sectionTestimonialsImage from "./images/Testimonials1.png"
import sectionTestimonials2Image from "./images/Testimonials2.png"
import sectionTestimonials3Image from "./images/Testimonials3.png"
import sectionTextImageImage from "./images/TextImage.png"
import { SearchIcon } from "./icons"
import { useMemo, useState } from "react"

import "./App.css"

framer.showUI({
    position: "top right",
    width: 350,
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
        key: "header background",
        title: "Header With Background",
        image: sectionHeaderBackgroundImage,
        url: "https://framer.com/m/framer/Section-Header-Image.js",
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
        key: "feature section",
        title: "Features Small",
        image: sectionFeaturesImage,
        url: "https://framer.com/m/framer/Section-Features.js",
    },
    {
        key: "templates section",
        title: "Templates",
        image: sectionTemplatesImage,
        url: "https://framer.com/m/framer/Section-Templates.js",
    },
    {
        key: "grid 1 section",
        title: "Grid 1",
        image: sectionGrid1Image,
        url: "https://framer.com/m/framer/Sections-Grid-1.js",
    },
    {
        key: "grid 2 section",
        title: "Grid 2",
        image: sectionGrid2Image,
        url: "https://framer.com/m/framer/Sections-Grid-2.js",
    },
    {
        key: "feature cards section",
        title: "Feature Cards",
        image: sectionFeatureCardsImage,
        url: "https://framer.com/m/framer/Section-Blog.js",
    },
    {
        key: "testimonials section",
        title: "Testimonials",
        image: sectionTestimonialsImage,
        url: "https://framer.com/m/framer/Section-Testimonials.js",
    },
    {
        key: "testimonials 3 section",
        title: "Testimonials 2",
        image: sectionTestimonials3Image,
        url: "https://framer.com/m/framer/Section-Testimonials-3.js",
    },
    {
        key: "testimonials 2 section",
        title: "Testimonials 3",
        image: sectionTestimonials2Image,
        url: "https://framer.com/m/framer/Section-Testimonials2.js",
    },
    {
        key: "contact section",
        title: "Contact",
        image: sectionContactImage,
        url: "https://framer.com/m/framer/Section-Contact.js",
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
        key: "logos section",
        title: "Logos",
        image: sectionLogosImage,
        url: "https://framer.com/m/framer/Section-Logos.js",
    },
    {
        key: "pivot section",
        title: "Pivot",
        image: sectionPivotImage,
        url: "https://framer.com/m/framer/Section-Pivot.js",
    },
]
export function App() {
    const [search, setSearch] = useState("")

    const filteredSectionItems = useMemo(() => {
        return layoutSectionItems.filter(item => item.title.toLowerCase().includes(search.toLowerCase()))
    }, [search])

    return (
        <main
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "10px",
            }}
        >
            <div className="search-container">
                <SearchIcon />
                <input
                    autoFocus
                    type="search"
                    placeholder="Search…"
                    className="search-input"
                    onChange={e => setSearch(e.target.value)}
                    value={search}
                />
            </div>

            {filteredSectionItems.length === 0 && (
                <div className="no-results">
                    <span>No results</span>
                </div>
            )}

            {filteredSectionItems.map(section => (
                <button
                    key={section.key}
                    onClick={() =>
                        framer.addDetachedComponentLayers({
                            url: section.url,
                            layout: true,
                        })
                    }
                >
                    <Draggable
                        data={{
                            type: "detachedComponentLayers",
                            url: section.url,
                            previewImage: section.image,
                            layout: true,
                        }}
                    >
                        <div className="section-container">
                            <div className="section-image">
                                <img src={section.image} alt={section.title} />
                            </div>
                        </div>
                    </Draggable>
                </button>
            ))}
        </main>
    )
}
