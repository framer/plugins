# Framer Property Controls

Control types for property controls in Framer components. Each control type specifies a different user interface for receiving input. All control types accept `title`, `description`, and `hidden` properties.

## Table of Contents

- [Boolean](#boolean)
- [Number](#number)
- [String](#string)
- [Enum](#enum)
- [Color](#color)
- [ResponsiveImage](#responsiveimage)
- [File](#file)
- [Array](#array)
- [Slot](#slot)
- [EventHandler](#eventhandler)
- [Font](#font)
- [Transition](#transition)
- [BoxShadow](#boxshadow)
- [Link](#link)
- [Date](#date)
- [Object](#object)
- [Border](#border)
- [Cursor](#cursor)
- [Padding](#padding)
- [BorderRadius](#borderradius)
- [Gap](#gap)
- [TrackingId](#trackingid)
- [Deprecated Controls](#deprecated-controls)
- [TypeScript Interfaces](#typescript-interfaces)

## Boolean

A control that displays an on/off checkbox. The associated property will be `true` or `false`, depending on the state of the checkbox.

**Properties:**

- `defaultValue`: Set to `true` by default
- `optional`: Whether the control value is optional
- `enabledTitle`: Customize the label when enabled _(deprecated)_
- `disabledTitle`: Customize the label when disabled _(deprecated)_

**Example:**

```javascript
export function MyComponent(props) {
  return <Frame size={"100%"}>{props.showText ? "Hello World" : null}</Frame>;
}

addPropertyControls(MyComponent, {
  showText: {
    type: ControlType.Boolean,
    title: "Show Text",
    defaultValue: true,
  },
});
```

## Number

A control that accepts any numeric value. This will be provided directly as a property. Displays an input field with a range slider by default.

**Properties:**

- `defaultValue`: The default numeric value
- `min`: Minimum allowed value
- `max`: Maximum allowed value
- `unit`: Unit label (e.g., "deg", "px")
- `step`: Increment value for the slider
- `displayStepper`: Enable to show a stepper control instead
- `optional`: Whether the control value is optional

**Example:**

```javascript
export function MyComponent(props) {
  return (
    <Frame rotateZ={props.rotation} size={"100%"}>
      {props.rotation}
    </Frame>
  );
}

addPropertyControls(MyComponent, {
  rotation: {
    type: ControlType.Number,
    defaultValue: 0,
    min: 0,
    max: 360,
    unit: "deg",
    step: 0.1,
    displayStepper: true,
  },
});
```

## String

A control that accepts plain text values. Displays an input field with an optional placeholder value.

**Properties:**

- `defaultValue`: The default text value
- `placeholder`: Placeholder text
- `obscured`: Set to true to use a password input field
- `displayTextArea`: Enable for a multi-line input area
- `preventLocalization`: Prevents automatic translation of the text
- `optional`: Whether the control value is optional

**Example:**

```javascript
export function MyComponent(props) {
  return (
    <Frame>
      {props.title} — {props.body}
    </Frame>
  );
}

addPropertyControls(MyComponent, {
  title: {
    type: ControlType.String,
    defaultValue: "Framer",
    placeholder: "Type something…",
  },
  body: {
    type: ControlType.String,
    defaultValue: "Lorem ipsum dolor sit amet.",
    placeholder: "Type something…",
    displayTextArea: true,
  },
});
```

## Enum

A property control that represents a list of options. The selected option will be provided as a property. Displayed as a dropdown menu.

**Properties:**

- `defaultValue`: The default selected option (string, boolean, number, or null)
- `options`: Array of unique values (string, boolean, number, or null)
- `optionTitles`: Display names for the options
- `displaySegmentedControl`: Enable to display a segmented control instead
- `segmentedControlDirection`: Direction of the segmented control ('horizontal' or 'vertical')

**Example:**

```javascript
export function MyComponent(props) {
  const value = props.value || "a";
  const colors = { a: "red", b: "green", c: "blue" };
  return (
    <Frame background={colors[value]} size={"100%"}>
      {value}
    </Frame>
  );
}

addPropertyControls(MyComponent, {
  value: {
    type: ControlType.Enum,
    defaultValue: "a",
    options: ["a", "b", "c"],
    optionTitles: ["Option A", "Option B", "Option C"],
  },
});
```

**Example with Segmented Control:**

```javascript
addPropertyControls(MyComponent, {
  alignment: {
    type: ControlType.Enum,
    defaultValue: "left",
    options: ["left", "center", "right"],
    optionTitles: ["Left", "Center", "Right"],
    displaySegmentedControl: true,
    segmentedControlDirection: "horizontal",
  },
});
```

## Color

A control that represents a color value. The selected color is provided as a string in either HEX (`"#fff"`) or HSL (`hsla(203, 87%, 50%, 0.5)`) notation, depending on whether there is an alpha channel.

**Properties:**

- `defaultValue`: The default color value
- `optional`: Whether the color is optional

**Example:**

```javascript
function MyComponent(props) {
  return <Frame background={props.background} size={"100%"} />;
}

addPropertyControls(MyComponent, {
  background: {
    type: ControlType.Color,
    defaultValue: "#fff",
  },
});
```

## ResponsiveImage

A control that allows the user to pick an image resource. Displayed as an image picker with associated file picker.

**Returns an object with:**

- `src`: URL string of the full resolution image
- `srcSet`: Optional string with scaled image variants (for `<img srcSet>`)
- `alt`: Optional description of the image

**Example:**

```javascript
function MyComponent(props) {
  return (
    <img
      src={props.image?.src}
      srcSet={props.image?.srcSet}
      alt={props.image?.alt}
    />
  );
}

addPropertyControls(MyComponent, {
  image: {
    type: ControlType.ResponsiveImage,
  },
});
```

## File

A control that allows the user to pick a file resource. The selected file will be provided as a fully qualified URL.

**Properties:**

- `allowedFileTypes`: Array specifying acceptable file types. Supported formats:
  - Media types (`"image/png"`, `"audio/*"`, `"*/*"`)
  - File extensions with dot (`".png"`, `".mov"`)
  - File extensions without dot (`"png"`) for backward compatibility
  - Wildcard (`"*"`) to allow everything

**Example:**

```javascript
export function MyComponent(props) {
  return (
    <Frame size={"100%"}>
      <video
        style={{
          objectFit: "contain",
          width: props.width,
          height: props.height,
        }}
        src={props.filepath}
        controls
      />
    </Frame>
  );
}

addPropertyControls(MyComponent, {
  filepath: {
    type: ControlType.File,
    allowedFileTypes: ["mov", "mp4"],
  },
});
```

## Array

A control that allows multiple values per `ControlType`, provided as an array via properties. Displays as an additional section in the properties panel.

**Properties:**

- `control`: The control type to repeat
- `minCount`: Minimum number of items
- `maxCount`: Maximum number of items
- `defaultValue`: Default array values

**Example with Objects:**

```javascript
export function MyComponent(props) {
  return (
    <Stack size={"100%"}>
      {props.items.map((item, index) => (
        <div key={index}>{item.title}</div>
      ))}
    </Stack>
  );
}

addPropertyControls(MyComponent, {
  items: {
    type: ControlType.Array,
    control: {
      type: ControlType.Object,
      controls: {
        title: { type: ControlType.String, defaultValue: "Item" },
        image: { type: ControlType.ResponsiveImage },
      },
    },
    defaultValue: [{ title: "First" }, { title: "Second" }],
    maxCount: 10,
  },
});
```

## Slot

A control that references one or more other components on the canvas, included in the component props as a React node. By default allows any number of components to be linked.

**Properties:**

- `maxCount`: Maximum number of components to be linked

**Example:**

```javascript
export function MyComponent(props) {
  return <Stack size={"100%"}>{props.children}</Stack>;
}

addPropertyControls(MyComponent, {
  children: {
    type: ControlType.Slot,
    maxCount: 5,
  },
});
```

## EventHandler

A control that exposes events in the prototyping panel within the Framer UI. When choosing an event, you can select from a list of actions to trigger.

**Example:**

```javascript
export function MyComponent(props) {
  return <Frame onTap={props.onTap} size={"100%"} />;
}

addPropertyControls(MyComponent, {
  onTap: {
    type: ControlType.EventHandler,
  },
});
```

## Font

A control that allows for selecting a font to be used in the component.

**Properties:**

- `defaultValue`: Default font settings
- `controls`: Specifies control options ("basic" or "extended")
- `defaultFontType`: Default font type ("sans-serif", "serif", or "monospace")
- `displayTextAlignment`: Whether to display text alignment options
- `displayFontSize`: Whether to display font size options

**Default Value Options:**

- `textAlign`: "left", "right", "center", or "justify"
- `fontSize`: string or number (e.g., "16px", 16)
- `letterSpacing`: string or number (e.g., "-0.01em", 0.1)
- `lineHeight`: string or number (e.g., "1.5em", 1.5, "150%")
- `variant`: Font variant (only for "sans-serif" font type)

**Example:**

```javascript
export function MyComponent(props) {
  return <div style={props.customFont}>Hello World</div>;
}

addPropertyControls(MyComponent, {
  customFont: {
    type: ControlType.Font,
    defaultValue: {
      fontSize: "16px",
      variant: "Medium",
      letterSpacing: "-0.01em",
      lineHeight: "1.2em",
      textAlign: "left",
    },
    controls: "extended",
    defaultFontType: "sans-serif",
  },
});
```

## Transition

A control that allows for editing Framer Motion transition options within the Framer UI.

**Properties:**

- `defaultValue`: Default transition (null or Transition object)

**Example:**

```javascript
export function MyComponent(props) {
  return <Frame animate={{ scale: 2 }} transition={props.transition} />;
}

addPropertyControls(MyComponent, {
  transition: {
    type: ControlType.Transition,
  },
});
```

## BoxShadow

A control that allows for exposing shadows. The value will be provided as a string with valid CSS box-shadow values.

**Properties:**

- `defaultValue`: Default shadow (string or BoxShadow array)

**Example:**

```javascript
export function MyComponent(props) {
  return <motion.div style={{ boxShadow: props.shadow }} />;
}

addPropertyControls(MyComponent, {
  shadow: {
    type: ControlType.BoxShadow,
  },
});
```

## Link

A control that allows for exposing web links.

**Properties:**

- `defaultValue`: Default URL as string

**Example:**

```javascript
export function MyComponent(props) {
  return <a href={props.link}>My Link</a>;
}

addPropertyControls(MyComponent, {
  link: {
    type: ControlType.Link,
  },
});
```

## Date

A control that allows for exposing dates. The value will be provided in toJSON() string format.

**Properties:**

- `displayTime`: Whether to include time selection
- `defaultValue`: Default date as ISO string
- `optional`: Whether the date is optional

**Example:**

```javascript
export function MyComponent(props) {
  const formattedDate = React.useMemo(() => {
    return props.date ? new Date(props.date).toLocaleDateString() : "No date";
  }, [props.date]);
  return <div>{formattedDate}</div>;
}

addPropertyControls(MyComponent, {
  date: {
    type: ControlType.Date,
    displayTime: true,
    optional: true,
  },
});
```

## Object

A control that allows for grouping multiple properties as an object.

**Properties:**

- `controls`: Object containing nested controls
- `defaultValue`: Default object values
- `buttonTitle`: Custom button title
- `optional`: Whether the object is optional
- `icon`: Icon to display ('object', 'effect', 'color', 'interaction', or 'boolean')

**Example:**

```javascript
export function MyComponent(props) {
  return (
    <Frame opacity={props.style?.opacity} background={props.style?.tint} />
  );
}

addPropertyControls(MyComponent, {
  style: {
    type: ControlType.Object,
    optional: true,
    icon: "effect",
    controls: {
      opacity: { type: ControlType.Number, defaultValue: 1, min: 0, max: 1 },
      tint: { type: ControlType.Color, defaultValue: "#000" },
    },
  },
});
```

## Border

A control that represents a border.

**Properties:**

- `defaultValue`: Default border settings
- `optional`: Whether the border is optional

**Border Value Object:**

- `borderColor`: CSS color string
- `borderStyle`: "solid", "dashed", "dotted", or "double"
- `borderWidth`: Uniform width (number)
- `borderTopWidth`, `borderLeftWidth`, `borderRightWidth`, `borderBottomWidth`: Per-side widths

**Example:**

```javascript
function MyComponent(props) {
  return <div style={props.border} />;
}

addPropertyControls(MyComponent, {
  border: {
    type: ControlType.Border,
    defaultValue: {
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: "rgba(0, 0, 0, 0.5)",
    },
  },
});
```

## Cursor

A control that allows specifying a web cursor that should be shown when mousing over the element assigned.

**Properties:**

- `defaultValue`: Default cursor value (CSS cursor string)

**Example:**

```javascript
function MyComponent(props) {
  return <div style={{ cursor: props.cursor }}>Hover me</div>;
}

addPropertyControls(MyComponent, {
  cursor: {
    type: ControlType.Cursor,
    defaultValue: "pointer",
  },
});
```

## Padding

A control that represents CSS padding.

**Properties:**

- `defaultValue`: Default padding value (e.g., "8px", "10px 20px", "10px 20px 30px 40px")

**Example:**

```javascript
function MyComponent({ padding }) {
  return <div style={{ padding }}>Content</div>;
}

addPropertyControls(MyComponent, {
  padding: {
    type: ControlType.Padding,
    defaultValue: "8px",
  },
});
```

## BorderRadius

A control that represents CSS border radius.

**Properties:**

- `defaultValue`: Default border radius value (e.g., "16px", "8px 16px")

**Example:**

```javascript
function MyComponent({ borderRadius }) {
  return <div style={{ borderRadius, background: "red" }} />;
}

addPropertyControls(MyComponent, {
  borderRadius: {
    type: ControlType.BorderRadius,
    defaultValue: "16px",
    title: "Radius",
  },
});
```

## Gap

A control that represents CSS gap for grid/flex layouts.

**Properties:**

- `defaultValue`: Default gap value (e.g., "8px", "8px 16px")

**Example:**

```javascript
function MyComponent({ gap, children }) {
  return <div style={{ display: "flex", gap }}>{children}</div>;
}

addPropertyControls(MyComponent, {
  gap: {
    type: ControlType.Gap,
    defaultValue: "8px",
  },
  children: {
    type: ControlType.Slot,
  },
});
```

## TrackingId

A control that represents an ID for tracking events.

**Format Requirements:**

- Lowercase letters (a-z) and numbers (0-9) only
- Hyphens (-) as separators (no leading/trailing or consecutive hyphens)
- Valid: "button-click", "form-submit", "video-play", "nav-item-1"
- Invalid: "Button-Click", "form--submit", "-button-click", "button_utils"

**Properties:**

- `defaultValue`: Default tracking ID string

**Example:**

```javascript
function MyComponent(props) {
  const handleClick = () => {
    // Track the event using props.trackingId
    analytics.track(props.trackingId);
  };
  return <button onClick={handleClick}>Click me</button>;
}

addPropertyControls(MyComponent, {
  trackingId: {
    type: ControlType.TrackingId,
    defaultValue: "button-click",
  },
});
```

## Deprecated Controls

### ControlType.Image

**Deprecated.** Use `ControlType.ResponsiveImage` instead. The `src` field provides the image URL.

### ControlType.ComponentInstance

**Deprecated.** Use `ControlType.Slot` instead. The new Slot type doesn't need to be nested within an array control for multiple items. By default, Slot allows infinite items; use `maxCount` to limit.

### ControlType.SegmentedEnum

**Deprecated.** Use `ControlType.Enum` with `displaySegmentedControl: true` instead.

### ControlType.FusedNumber

**Deprecated.** Use `ControlType.Padding` and `ControlType.BorderRadius` instead. These new controls provide a single value (e.g., "10px" or "10px 20px 30px 40px").

For TypeScript interfaces and type definitions, see [Property Control Types](PROPERTY_CONTROL_TYPES.md).
