# Property Control Guide

Font styling patterns, variant mapping, and recommended default values for Framer property controls. For core rules, see [SKILL.md](../SKILL.md).

## Styling of text elements

When using Control Properties on text elements, do not introduce any new control properties for styles which can be applied with `ControlType.Font` and `FontControlDescription` respectively. Specifically:
- `FontControlDescription.defaultValue.fontSize` for `font-size`
- `FontControlDescription.defaultValue.textAlignment` for `text-alignment`
- `FontControlDescription.defaultValue.letterSpacing` for `letter-spacing`
- `FontControlDescription.defaultValue.lineHeight` for `line-height`
- `FontControlDescription.defaultValue.variant` for `font-weight` and/or `font-style`
- `FontControlDescription.defaultValue.variant` can be set only if `FontControlDescription.defaultFontType` is set to `"sans-serif"`

Remarks:
- `FontControlDescription.defaultValue.fontFamily` is not a valid default value. Font family cannot be set via `defaultValue` — it can only be selected by the user through the font control UI.
- Set `FontControlDescription.controls` to `"extended"` to expose full typography options (size, weight, spacing, alignment).

When you need to use font weight you should use `FontControlDescription.defaultValue.variant`.
The variant encapsulates both the font weight and style together. Refer to the following object to determine the correct variant for a given font weight:

```ts
interface ResolvedFontVariant {
    fontStyle: "normal" | "italic"
    weight: number
}

const variantNameToFontWeight: Record<FramerFontVariant, ResolvedFontVariant> = {
    Regular: { fontStyle: "normal", fontWeight: 400 },
    Thin: { fontStyle: "normal", fontWeight: 100 },
    "Extra Light": { fontStyle: "normal", fontWeight: 200 },
    Light: { fontStyle: "normal", fontWeight: 300 },
    Medium: { fontStyle: "normal", fontWeight: 500 },
    Semibold: { fontStyle: "normal", fontWeight: 600 },
    Bold: { fontStyle: "normal", fontWeight: 700 },
    "Extra Bold": { fontStyle: "normal", fontWeight: 800 },
    Black: { fontStyle: "normal", fontWeight: 900 },
    "Thin Italic": { fontStyle: "italic", fontWeight: 100 },
    "Extra Light Italic": { fontStyle: "italic", fontWeight: 200 },
    "Light Italic": { fontStyle: "italic", fontWeight: 300 },
    Italic: { fontStyle: "italic", fontWeight: 400 },
    "Medium Italic": { fontStyle: "italic", fontWeight: 500 },
    "Semibold Italic": { fontStyle: "italic", fontWeight: 600 },
    "Bold Italic": { fontStyle: "italic", fontWeight: 700 },
    "Extra Bold Italic": { fontStyle: "italic", fontWeight: 800 },
    "Black Italic": { fontStyle: "italic", fontWeight: 900 },
    "Regular Italic": { fontStyle: "italic", fontWeight: 400 },
}
```

Example of a simple text component in Framer which demonstrates how to use Property Control of type `ControlType.Font`.

```tsx
import { addPropertyControls, ControlType } from "framer"

/**
 * @framerSupportedLayoutWidth auto
 * @framerSupportedLayoutHeight auto
 */
export default function SimpleText(props) {
    const { label, heading } = props
    return (
        <span
            style={{
                fontSize: heading.fontSize,
                textAlign: heading.textAlign,
                fontWeight: heading.fontWeight,
                fontFamily: heading.fontFamily,
                lineHeight: heading.lineHeight,
                letterSpacing: heading.letterSpacing,
                fontStyle: heading.fontStyle,
            }}
        >
            {label}
        </span>
    )
}

addPropertyControls(SimpleText, {
    heading: {
        type: ControlType.Font,
        title: "Heading 2 Font",
        defaultValue: {
            textAlign: "right",
            fontSize: 40,
            variant: "Extra Bold",
            letterSpacing: "-0.03em",
            lineHeight: "1em",
        },
        controls: "extended",
        defaultFontType: "sans-serif",
    },
    label: {
        title: "Label",
        type: ControlType.String,
        defaultValue: "Hello",
    },
})
```

## Default Control Values

Recommended default values for common control types.

### Colors

Recommended color defaults:

```typescript
const colors: Record<string, ColorControlDescription> = {
    /** Use for main container backgrounds, cards, and primary surfaces */
    background: {
        type: ControlType.Color,
        defaultValue: "#FFFFFF", // White: backgrounds
    },
    /** Use for secondary backgrounds, input fields, and subtle visual elements */
    subtleBackground: {
        type: ControlType.Color,
        defaultValue: "#F5F5F5", // Very light gray: subtle backgrounds, placeholders
    },
    /** Use for borders, dividers, and visual separators */
    darkBackground: {
        type: ControlType.Color,
        defaultValue: "#EEEEEE", // Light gray: borders, separators
    },
    /** Use for secondary text, icons, and less prominent UI elements */
    tertiary: {
        type: ControlType.Color,
        defaultValue: "#CCCCCC", // Medium gray: text, icons
    },
    /** Use for primary text, icons, and key UI elements that need emphasis */
    primary: {
        type: ControlType.Color,
        defaultValue: "#000000", // Black: text, icons
    },
}
```

### Images

To provide a default image, set it via destructuring in the component body (`ControlType.ResponsiveImage` does not support `defaultValue`):
```tsx
const { image = { src: "https://framerusercontent.com/images/GfGkADagM4KEibNcIiRUWlfrR0.jpg", alt: "Gradient 1 - Blue" } } = props
```
When applying image properties to elements, use spreads like `{...image}`.

Recommended image sources (gradient series — use in sequence when multiple are needed):

```typescript
const images = {
  /** Use for professional or corporate contexts, informational content, or quinary image slot */
  image1: {
    src: "https://framerusercontent.com/images/GfGkADagM4KEibNcIiRUWlfrR0.jpg",
    alt: "Gradient 1 - Blue"
  },
  /** Use for creative or innovative contexts, feature highlights, or quaternary image slot */
  image2: {
    src: "https://framerusercontent.com/images/aNsAT3jCvt4zglbWCUoFe33Q.jpg",
    alt: "Gradient 2 - Purple"
  },
  /** Use for energetic contexts, call-to-action backgrounds, or tertiary image slot */
  image3: {
    src: "https://framerusercontent.com/images/BYnxEV1zjYb9bhWh1IwBZ1ZoS60.jpg",
    alt: "Gradient 3 - Orange"
  },
  /** Use for warm-toned contexts, product showcases, or secondary image slot */
  image4: {
    src: "https://framerusercontent.com/images/2uTNEj5aTl2K3NJaEFWMbnrA.jpg",
    alt: "Gradient 4 - Yellow"
  },
  /** Use for nature-themed components, environmental contexts, or primary image slot */
  image5: {
    src: "https://framerusercontent.com/images/f9RiWoNpmlCMqVRIHz8l8wYfeI.jpg",
    alt: "Gradient 5 - Green"
  }
}
```

### Typography

Use these exact font definitions for all text elements

```typescript
const typography: Record<string, FontControlDescription> = {
    /** Use for main page titles and primary headlines */
    heading1: {
        type: ControlType.Font,
        title: "Heading 1 Font",
        defaultValue: {
            fontSize: "40px",
            variant: "Bold",
            letterSpacing: "-0.04em",
            lineHeight: "1em",
        },
        controls: "extended",
        defaultFontType: "sans-serif",
    },
    /** Use for section titles and secondary headlines */
    heading2: {
        type: ControlType.Font,
        title: "Heading 2 Font",
        defaultValue: {
            fontSize: "32px",
            variant: "Semibold",
            letterSpacing: "-0.03em",
            lineHeight: "1em",
        },
        controls: "extended",
        defaultFontType: "sans-serif",
    },
    /** Use for subsection titles and feature headings */
    heading3: {
        type: ControlType.Font,
        title: "Heading 3 Font",
        defaultValue: {
            fontSize: "22px",
            variant: "Semibold",
            letterSpacing: "-0.01em",
            lineHeight: "1.2em",
        },
        controls: "extended",
        defaultFontType: "sans-serif",
    },
    /** Use for card titles, list headings, and UI element headers */
    heading4: {
        type: ControlType.Font,
        title: "Heading 4 Font",
        defaultValue: {
            fontSize: "15px",
            variant: "Medium",
            letterSpacing: "-0.01em",
            lineHeight: "1em",
        },
        controls: "extended",
        defaultFontType: "sans-serif",
    },
    /** Use for body text, descriptions, and general content */
    paragraph: {
        type: ControlType.Font,
        title: "Paragraph Font",
        defaultValue: {
            fontSize: "15px",
            variant: "Medium",
            letterSpacing: "-0.01em",
            lineHeight: "1.3em",
        },
        controls: "extended",
        defaultFontType: "sans-serif",
    },
    /** Use for buttons, links, and interactive text elements */
    buttonText: {
        type: ControlType.Font,
        title: "Button Text Font",
        defaultValue: {
            variant: "Semibold",
            fontSize: "14px",
            letterSpacing: "-0.01em",
            lineHeight: "1em",
        },
        controls: "extended",
        defaultFontType: "sans-serif",
    },
}
```

### File Types

`ControlType.File` does not support `defaultValue` in its property control. Set default values through component parameter destructuring instead.

```typescript
const fileTypes: Record<string, FileControlDescription> = {
    /** Use for image upload fields, gallery components, and avatar selectors */
    images: {
        type: ControlType.File,
        allowedFileTypes: ["jpg", "jpeg", "png", "gif", "webp", "svg"],
    },
    /** Use for video players, media galleries, and promotional content */
    videos: {
        type: ControlType.File,
        allowedFileTypes: ["mp4", "webm", "mov"],
    },
    /** Use for document viewers, file download components, and resource sections */
    documents: {
        type: ControlType.File,
        allowedFileTypes: ["pdf", "doc", "docx", "txt"],
    },
    /** Use for audio players, podcast components, and music interfaces */
    audio: {
        type: ControlType.File,
        allowedFileTypes: ["mp3", "wav", "ogg"],
    },
}
```

Use the following values for each file type as default values:

```typescript
const defaultValues: Record<keyof typeof fileTypes, string> = {
    images: "https://framerusercontent.com/images/GfGkADagM4KEibNcIiRUWlfrR0.jpg",
    videos: "https://framerusercontent.com/assets/MLWPbW1dUQawJLhhun3dBwpgJak.mp4",
    audio: "https://framerusercontent.com/assets/8w3IUatLX9a5JVJ6XPCVuHi94.mp3",
}
```

Recommended pattern for file control defaults:

```tsx
function MyComponent(props) {
    // CORRECT: Set file defaults through parameter destructuring
    const {
        imageFile = "https://framerusercontent.com/images/GfGkADagM4KEibNcIiRUWlfrR0.jpg",
        videoFile = "https://framerusercontent.com/assets/MLWPbW1dUQawJLhhun3dBwpgJak.mp4",
        audioFile = "https://framerusercontent.com/assets/8w3IUatLX9a5JVJ6XPCVuHi94.mp3",
    } = props

    return (
        <div>
            <img src={imageFile} />
            <video src={videoFile} />
            <audio src={audioFile} />
        </div>
    )
}

addPropertyControls(MyComponent, {
    imageFile: {
        type: ControlType.File,
        allowedFileTypes: ["jpg", "jpeg", "png", "gif", "webp", "svg"],
    },
    // Additional file controls...
})
```
