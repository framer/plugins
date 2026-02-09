---
name: framer-component-best-practices
description: Best practices for building and improving React code components in Framer, a no-code website builder. Covers property controls, animations, accessibility, and platform constraints. Use when creating, editing, or reviewing Framer components, working with ControlType property controls, or building React components for Framer projects.
license: MIT
metadata:
  author: framer
  version: "1.0"
---

# Framer Component Best Practices

Best practices for building and improving React components in Framer with property controls, animations, and accessibility.

## Core Rules

### Component Structure

```tsx
import { addPropertyControls, ControlType } from "framer";
import { motion } from "framer-motion"; // NOT from "framer"

interface MyComponentProps {
  /* typed props */
}

/**
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function MyComponent(props: MyComponentProps) {
  // component
}

addPropertyControls(MyComponent, {
  /* controls */
});
```

### Platform Constraints

These will cause errors if violated:

1. **Single file, default export** - Use named `function` syntax (not arrow functions), no named exports
2. **Imports** - Only `react`, `react-dom`, `framer`, `framer-motion`. Import `motion` from `"framer-motion"`, not `"framer"`
3. **Position** - Use `position: relative` on the root element, never `fixed`
4. **SSR** - Guard `window`/`document` access: `if (typeof window !== "undefined")`
5. **Annotations** - Include `@framerSupportedLayoutWidth/Height` in a `/** */` block comment immediately above the component function
6. **Types** - Provide a typed props interface (e.g. `MyComponentProps`). Avoid NodeJS types like `Timeout` — use `number` instead

### Layout Annotations

| Content           | Width              | Height             |
| ----------------- | ------------------ | ------------------ |
| No intrinsic size | `fixed`            | `fixed`            |
| Text/auto-sizing  | `auto`             | `auto`             |
| Flexible          | `any-prefer-fixed` | `any-prefer-fixed` |

Detect auto vs fixed sizing: check if `style.width` or `style.height` is `"100%"`.

### Property Controls

To make components configurable in Framer's properties panel, add property controls:

- To make colors customizable, use `ControlType.Color`. Reuse the same prop for elements sharing a color.
- To make text styling customizable, use `ControlType.Font` with `controls: "extended"` and `defaultFontType: "sans-serif"`.
- For images, use `ControlType.ResponsiveImage`. Set defaults in the component body via destructuring (the control doesn't support `defaultValue`).
- Provide a `defaultValue` for every prop so components render correctly in the Framer canvas. Include at least one item in `ControlType.Array` controls.
- `ComponentName.defaultProps` is not supported in Framer — use `defaultValue` on the property control instead.
- Use `hidden` for conditional visibility: `hidden: (props) => !props.showFeature`
- Prefer sliders over steppers unless step values are large.
- Keep controls focused — make key elements configurable, hardcode the rest.
- See [Property Control Guide](references/PROPERTY_CONTROL_GUIDE.md) for detailed patterns, font styling rules, and recommended default values.

### Image Defaults (in component body)

```tsx
const {
  image = {
    src: "https://framerusercontent.com/images/GfGkADagM4KEibNcIiRUWlfrR0.jpg",
    alt: "Default",
  },
} = props;
```

### Animation Performance

```tsx
import { useIsStaticRenderer } from "framer";
import { useInView } from "framer-motion";

const isStatic = useIsStaticRenderer();
const ref = useRef(null);
const isInView = useInView(ref);

if (isStatic) return <StaticPreview />; // Show useful static state
// Pause animations when out of viewport
```

- For very complex animations, consider WebGL instead of `framer-motion`.
- Static preview should include visual effects, not just text.
- Wrapping state updates in `startTransition()` prevents UI blocking and keeps interactions smooth.

### Text

- For auto-sized components with text, apply `width: max-content` or `minWidth: max-content` to prevent text from collapsing.

### Common Errors

- WebGL cross-origin: handle `SecurityError: Failed to execute 'texImage2D'` for cross-origin images.
- Inverted Y-axis: check if WebGL images render upside down and accommodate.

### Accessibility

- `aria` roles on interactive elements
- Semantic HTML (`<nav>`, `<article>`, `<section>`)
- `alt=""` on decorative images
- 4.5:1 color contrast

## Term Interpretation

- "responsive" → width/height 100%
- "modern" → 8px radius, 16px spacing, subtle shadows
- "minimal" → limited colors, whitespace
- "interactive" → hover/active states
- "accessible" → ARIA, semantic HTML
- "props"/"properties" → Framer property controls

## Reference Files

- [Property Controls](references/PROPERTY_CONTROLS.md) - All ControlType documentation with examples
- [Property Control Types](references/PROPERTY_CONTROL_TYPES.md) - TypeScript interfaces for all control types
- [Property Control Guide](references/PROPERTY_CONTROL_GUIDE.md) - Font patterns, styling rules, and recommended default values
- [Example Components](references/EXAMPLES.md) - Cookie banner, image compare, sticky notes, twemoji
