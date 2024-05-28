import { framer, Draggable } from "framer-plugin"
import "./App.css"

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

framer.showUI({
  title: "Layout Insert",
  position: "top right",
  width: 350,
})

interface DatasourceItem {
  image: string
  url: string
  title: string
  key: string
  intrinsicWidth: number
  intrinsicHeight: number
  aspectRatio: number
}

const layoutSectionItems: DatasourceItem[] = [
  {
    key: "header section",
    title: "Header",
    image: sectionHeaderImage,
    aspectRatio: 210 / 420,
    intrinsicWidth: 1200,
    intrinsicHeight: 600,
    url: "https://framer.com/m/framer/Section-Header.js",
  },
  {
    key: "header background",
    title: "Header With Background",
    image: sectionHeaderBackgroundImage,
    aspectRatio: 210 / 420,
    intrinsicWidth: 1200,
    intrinsicHeight: 600,
    url: "https://framer.com/m/framer/Section-Header-Image.js",
  },
  {
    key: "text image",
    title: "Text and Image",
    image: sectionTextImageImage,
    aspectRatio: 210 / 420,
    intrinsicWidth: 1200,
    intrinsicHeight: 600,
    url: "https://framer.com/m/framer/section-text-image.js",
  },
  {
    key: "image text",
    title: "Image and Text",
    image: sectionImageTextImage,
    aspectRatio: 210 / 420,
    intrinsicWidth: 1200,
    intrinsicHeight: 600,
    url: "https://framer.com/m/framer/section-image-text.js",
  },
  {
    key: "feature section 2",
    title: "Features Large",
    image: sectionFeaturesLargeImage,
    aspectRatio: 368 / 420,
    intrinsicWidth: 1200,
    intrinsicHeight: 1050,
    url: "https://framer.com/m/framer/section-features-large.js",
  },
  {
    key: "feature section",
    title: "Features Small",
    image: sectionFeaturesImage,
    aspectRatio: 259 / 420,
    intrinsicWidth: 1200,
    intrinsicHeight: 880,
    url: "https://framer.com/m/framer/Section-Features.js",
  },
  {
    key: "templates section",
    title: "Templates",
    image: sectionTemplatesImage,
    aspectRatio: 207 / 420,
    intrinsicWidth: 1200,
    intrinsicHeight: 840,
    url: "https://framer.com/m/framer/Section-Templates.js",
  },
  {
    key: "grid 1 section",
    title: "Grid 1",
    image: sectionGrid1Image,
    aspectRatio: 408 / 420,
    intrinsicWidth: 1200,
    intrinsicHeight: 1111,
    url: "https://framer.com/m/framer/Sections-Grid-1.js",
  },
  {
    key: "grid 2 section",
    title: "Grid 2",
    image: sectionGrid2Image,
    aspectRatio: 413 / 420,
    intrinsicWidth: 1200,
    intrinsicHeight: 1124,
    url: "https://framer.com/m/framer/Sections-Grid-2.js",
  },
  {
    key: "feature cards section",
    title: "Feature Cards",
    image: sectionFeatureCardsImage,
    aspectRatio: 229 / 420,
    intrinsicWidth: 1200,
    intrinsicHeight: 761,
    url: "https://framer.com/m/framer/Section-Blog.js",
  },
  {
    key: "testimonials section",
    title: "Testimonials",
    image: sectionTestimonialsImage,
    aspectRatio: 196 / 420,
    intrinsicWidth: 1200,
    intrinsicHeight: 668,
    url: "https://framer.com/m/framer/Section-Testimonials.js",
  },
  {
    key: "testimonials 3 section",
    title: "Testimonials 2",
    image: sectionTestimonials3Image,
    aspectRatio: 394 / 420,
    intrinsicWidth: 1200,
    intrinsicHeight: 1162,
    url: "https://framer.com/m/framer/Section-Testimonials-3.js",
  },
  {
    key: "testimonials 2 section",
    title: "Testimonials 3",
    image: sectionTestimonials2Image,
    aspectRatio: 174 / 420,
    intrinsicWidth: 1200,
    intrinsicHeight: 498,
    url: "https://framer.com/m/framer/Section-Testimonials2.js",
  },
  {
    key: "contact section",
    title: "Contact",
    image: sectionContactImage,
    aspectRatio: 214 / 420,
    intrinsicWidth: 1200,
    intrinsicHeight: 610,
    url: "https://framer.com/m/framer/Section-Contact.js",
  },
  {
    key: "pricing section",
    title: "Pricing",
    image: sectionPricingImage,
    aspectRatio: 215 / 420,
    intrinsicWidth: 1200,
    intrinsicHeight: 715,
    url: "https://framer.com/m/framer/Section-Pricing.js",
  },
  {
    key: "faq section",
    title: "FAQ",
    image: sectionFAQImage,
    aspectRatio: 180 / 420,
    intrinsicWidth: 1200,
    intrinsicHeight: 502,
    url: "https://framer.com/m/framer/Section-FAQ.js",
  },
  {
    key: "logos section",
    title: "Logos",
    image: sectionLogosImage,
    aspectRatio: 128 / 420,
    intrinsicWidth: 1200,
    intrinsicHeight: 366,
    url: "https://framer.com/m/framer/Section-Logos.js",
  },
  {
    key: "pivot section",
    title: "Pivot",
    image: sectionPivotImage,
    aspectRatio: 116 / 420,
    intrinsicWidth: 1200,
    intrinsicHeight: 260,
    url: "https://framer.com/m/framer/Section-Pivot.js",
  },
]
export function App() {
  const [search, setSearch] = useState("")

  const filteredSectionItems = useMemo(() => {
    return layoutSectionItems.filter((item) =>
      item.title.toLowerCase().includes(search.toLowerCase())
    )
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
          placeholder="Search..."
          className="search-input"
          onChange={(e) => setSearch(e.target.value)}
          value={search}
        />
      </div>

      {filteredSectionItems.length === 0 && (
        <div className="no-results">
          <span>No results</span>
        </div>
      )}

      {filteredSectionItems.map((section) => (
        <button
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
