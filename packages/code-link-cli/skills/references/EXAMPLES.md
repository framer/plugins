# Framer Component Examples

Reference implementations demonstrating best practices.

## Cookie Banner

Location-aware cookie consent with timezone detection.

```tsx
// Cookie banner with opt-in for Europe, opt-out elsewhere, based on time zone
import {
  useEffect,
  useState,
  startTransition,
  type CSSProperties,
} from "react";
import { addPropertyControls, ControlType, RenderTarget } from "framer";

interface CookiebannerProps {
  message: string;
  acceptLabel: string;
  declineLabel: string;
  backgroundColor: string;
  textColor: string;
  buttonColor: string;
  buttonTextColor: string;
  font: any;
  borderRadius: number;
  buttonFont: any;
  style?: CSSProperties;
}

/**
 * Cookies
 *
 * @framerIntrinsicWidth 400
 * @framerIntrinsicHeight 100
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function Cookiebanner(props: CookiebannerProps) {
  const {
    message,
    acceptLabel,
    declineLabel,
    backgroundColor,
    textColor,
    buttonColor,
    buttonTextColor,
    font,
    borderRadius,
  } = props;

  // Guess if user is in Europe based on timezone offset
  const [show, setShow] = useState(true);
  const [isEurope, setIsEurope] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const offset = new Date().getTimezoneOffset();
      // Europe: UTC+0 to UTC+3 (offset -0 to -180)
      startTransition(() => setIsEurope(offset <= 0 && offset >= -180));
    }
  }, []);

  // Hide on accept/decline
  function handleAccept() {
    startTransition(() => setShow(false));
  }
  function handleDecline() {
    startTransition(() => setShow(false));
  }

  if (!show || RenderTarget.current() === RenderTarget.thumbnail) return null;

  const buttonBaseStyles = {
    borderRadius: 10,
    flex: 1,
    border: `1px solid ${buttonColor}`,
    padding: "8px 18px",
    cursor: "pointer",
    ...props.buttonFont,
  };

  const isFixedWidth = props?.style && props.style.width === "100%";

  return (
    <div
      style={{
        ...props.style,
        overflow: "hidden",
        position: "relative",
        ...(isFixedWidth ? { ...props?.style } : { minWidth: "max-content" }),
        background: backgroundColor,
        color: textColor,
        borderRadius,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 20,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        gap: 20,

        ...props.font,
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      <div style={{ width: "100%", display: "flex", gap: 10 }}>
        <button
          style={{
            ...buttonBaseStyles,
            background: "transparent",
            color: buttonColor,
          }}
          onClick={handleDecline}
        >
          {declineLabel}
        </button>
        <button
          style={{
            ...buttonBaseStyles,
            background: buttonColor,
            color: buttonTextColor,
          }}
          onClick={handleAccept}
        >
          {acceptLabel}
        </button>
      </div>
    </div>
  );
}

addPropertyControls(Cookiebanner, {
  message: {
    type: ControlType.String,
    title: "Message",
    defaultValue: "We use cookies to improve your website experience.",
    displayTextArea: true,
  },
  acceptLabel: {
    type: ControlType.String,
    title: "Accept Label",
    defaultValue: "Accept",
  },
  declineLabel: {
    type: ControlType.String,
    title: "Decline Label",
    defaultValue: "Decline",
  },
  backgroundColor: {
    type: ControlType.Color,
    title: "Background",
    defaultValue: "#fff",
  },
  textColor: {
    type: ControlType.Color,
    title: "Text Color",
    defaultValue: "#222",
  },
  buttonColor: {
    type: ControlType.Color,
    title: "Button Color",
    defaultValue: "#111",
  },
  buttonTextColor: {
    type: ControlType.Color,
    title: "Button Text",
    defaultValue: "#fff",
  },
  font: {
    type: ControlType.Font,
    title: "Font",
    controls: "extended",
    defaultFontType: "sans-serif",
    defaultValue: {
      variant: "Medium",
      fontSize: "14px",
      letterSpacing: "-0.01em",
      lineHeight: "1em",
    },
  },
  buttonFont: {
    type: ControlType.Font,
    title: "Font",
    controls: "extended",
    defaultFontType: "sans-serif",
    defaultValue: {
      variant: "Medium",
      fontSize: "14px",
      letterSpacing: "-0.01em",
      lineHeight: "1em",
    },
  },
  borderRadius: {
    type: ControlType.Number,
    title: "Radius",
    defaultValue: 8,
    min: 0,
    max: 32,
  },
});
```

## Tweemoji

Convert emoji to Twitter's Twemoji SVGs.

````tsx
import { useMemo, useEffect, useState, type CSSProperties } from "react";
import { addPropertyControls, ControlType, withCSS } from "framer";
import twemojiParser from "https://jspm.dev/twemoji-parser@14.0.0";

const fireSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f525.svg";

interface TwemojiProps {
  /** Emoji to convert such as 🍐, 🐙 or 🐸 */
  search?: string;
  isSelection?: boolean;
  [prop: string]: any;
}

const baseURL = "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/";

/**
 * TWEMOJI
 *
 * Convert any emoji into a Twemoji from Twitter. Choose a preset or type in your emoji and the Twemoji will automatically appear on the canvas.
 *
 * ```jsx
 * <Twemoji search="🍐" />
 * ```
 *
 * @framerIntrinsicWidth 100
 * @framerIntrinsicHeight 100
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */
export default function Twemoji(props: TwemojiProps) {
  const { search, isSelection, selection, style, alt = "" } = props;

  const emoji = useMemo(() => {
    if (isSelection) return selection;
    if (!search) return "⭐️";
    return search;
  }, [search, isSelection, selection]);

  const src = useMemo(() => {
    const parsedTwemoji = twemojiParser.parse(emoji, {
      buildUrl: (icon) => `${baseURL}${icon}.svg`,
    });
    return parsedTwemoji[0].url;
  }, [emoji]);

  return (
    <div style={containerStyle}>
      <img src={src} style={containerStyle} alt={alt} />
    </div>
  );
}

addPropertyControls<TwemojiProps>(Twemoji, {
  isSelection: {
    type: ControlType.Boolean,
    title: "Select",
    enabledTitle: "Preset",
    disabledTitle: "Search",
  },
  selection: {
    type: ControlType.Enum,
    title: " ",
    options: ["🔥", "💖", "😆", "👍", "👎"],
    defaultValue: "🔥",
    displaySegmentedControl: true,
    hidden: ({ isSelection }) => !isSelection,
  },
  search: {
    type: ControlType.String,
    title: " ",
    placeholder: "Paste Emoji…",
    defaultValue: "⭐️",
    hidden: ({ isSelection }) => isSelection,
  },
});

const containerStyle: CSSProperties = {
  height: "100%",
  width: "100%",
  objectFit: "contain",
  textAlign: "center",
  overflow: "hidden",
  backgroundColor: "transparent",
};
````

## Image Compare

Before/after image comparison slider.

```tsx
import {
  addPropertyControls,
  ControlType,
  RenderTarget,
  useIsStaticRenderer,
} from "framer";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  startTransition,
  type CSSProperties,
} from "react";

interface Image {
  src: string;
  alt: string;
}

interface ImageCompareProps {
  beforeImage: Image;
  afterImage: Image;
  orientation: "horizontal" | "vertical";
  initialPosition: number;
  dividerColor: string;
  dividerWidth: number;
  dividerShadow: boolean;
  showHandle: boolean;
  handleColor: string;
  handleSize: number;
  style?: CSSProperties;
}

/**
 * Image Comparison Slider
 *
 * A component that allows users to compare two images by dragging a divider.
 *
 * @framerIntrinsicWidth 500
 * @framerIntrinsicHeight 300
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */
export default function ImageCompare(props: ImageCompareProps) {
  const {
    beforeImage = {
      src: "https://framerusercontent.com/images/GfGkADagM4KEibNcIiRUWlfrR0.jpg",
      alt: "Before image",
    },
    afterImage = {
      src: "https://framerusercontent.com/images/aNsAT3jCvt4zglbWCUoFe33Q.jpg",
      alt: "After image",
    },
    orientation = "horizontal",
    initialPosition = 50,
    dividerColor = "#FFFFFF",
    dividerWidth = 2,
    dividerShadow = true,
    showHandle = false,
    handleColor = "#FFFFFF",
    handleSize = 40,
  } = props;

  const isHorizontal = orientation === "horizontal";
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const isStatic = useIsStaticRenderer();

  const updatePositionFromEvent = useCallback(
    (e) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();

      if (isHorizontal) {
        const x = e.clientX - rect.left;
        const newPosition = Math.max(0, Math.min(100, (x / rect.width) * 100));
        startTransition(() => setPosition(newPosition));
      } else {
        const y = e.clientY - rect.top;
        const newPosition = Math.max(0, Math.min(100, (y / rect.height) * 100));
        startTransition(() => setPosition(newPosition));
      }
    },
    [isHorizontal],
  );

  const handleClick = useCallback(
    (e) => {
      // Only handle as a click if we're not dragging
      if (!isDragging) {
        updatePositionFromEvent(e);
      }
    },
    [isDragging, updatePositionFromEvent],
  );

  const handleDoubleClick = () => {
    startTransition(() => setPosition(initialPosition));
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    startTransition(() => setIsDragging(true));
  };

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging || !containerRef.current) return;
      updatePositionFromEvent(e);
    },
    [isDragging, updatePositionFromEvent],
  );

  const handleMouseUp = useCallback(() => {
    startTransition(() => setIsDragging(false));
  }, []);

  // Add global event listeners for drag
  useEffect(() => {
    if (isStatic) return;

    const handleGlobalMouseMove = (e) => handleMouseMove(e);
    const handleGlobalMouseUp = () => handleMouseUp();

    if (isDragging) {
      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, isStatic]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor: isDragging
          ? isHorizontal
            ? "ew-resize"
            : "ns-resize"
          : "pointer",
        userSelect: "none",
      }}
      onClick={isStatic ? undefined : handleClick}
      onMouseMove={isStatic ? undefined : handleMouseMove}
      onMouseDown={isStatic ? undefined : handleMouseDown}
      onMouseUp={isStatic ? undefined : handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          handleClick(e);
        }
      }}
      tabIndex={0}
      role="slider"
      aria-valuenow={position}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-orientation={orientation}
    >
      {/* After Image (Full) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundImage: `url(${afterImage.src})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        aria-label={afterImage.alt}
        role="img"
      />

      {/* Before Image (Clipped) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundImage: `url(${beforeImage.src})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          clipPath: isHorizontal
            ? `inset(0 ${100 - position}% 0 0)`
            : `inset(0 0 ${100 - position}% 0)`,
        }}
        aria-label={beforeImage.alt}
        role="img"
      />

      {/* Divider */}
      <div
        style={{
          position: "absolute",
          top: isHorizontal ? 0 : `${position}%`,
          left: isHorizontal ? `${position}%` : 0,
          width: isHorizontal ? `${dividerWidth}px` : "100%",
          height: isHorizontal ? "100%" : `${dividerWidth}px`,
          backgroundColor: dividerColor,
          boxShadow: dividerShadow ? "0 0 5px rgba(0, 0, 0, 0.7)" : "none",
          transform: isHorizontal
            ? `translateX(-${dividerWidth / 2}px)`
            : `translateY(-${dividerWidth / 2}px)`,
          cursor: isHorizontal ? "ew-resize" : "ns-resize",
          zIndex: 2,
        }}
        onMouseDown={isStatic ? undefined : handleMouseDown}
      />

      {/* Handle */}
      {showHandle && (
        <div
          style={{
            position: "absolute",
            top: isHorizontal
              ? `calc(50% - ${handleSize / 2}px)`
              : `${position}%`,
            left: isHorizontal
              ? `${position}%`
              : `calc(50% - ${handleSize / 2}px)`,
            width: `${handleSize}px`,
            height: `${handleSize}px`,
            borderRadius: "50%",
            backgroundColor: handleColor,
            border: `2px solid ${handleColor}`,
            boxShadow: "0 0 5px rgba(0, 0, 0, 0.5)",
            transform: isHorizontal
              ? `translateX(-${handleSize / 2}px)`
              : `translateY(-${handleSize / 2}px)`,
            cursor: isHorizontal ? "ew-resize" : "ns-resize",
            zIndex: 3,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
          onMouseDown={isStatic ? undefined : handleMouseDown}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
              height: "100%",
              transform: isHorizontal ? "rotate(90deg)" : "rotate(0deg)",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={handleSize * 0.5}
              height={handleSize * 0.5}
              strokeWidth="2"
              stroke="#000"
              fill="none"
              aria-label="Drag handle"
            >
              <title>Drag handle</title>
              <path d="M13 5l6 6m-6 6l6-6m-6 0l-6 6m6-6l-6-6" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

addPropertyControls(ImageCompare, {
  beforeImage: {
    type: ControlType.ResponsiveImage,
    title: "Before Image",
  },
  afterImage: {
    type: ControlType.ResponsiveImage,
    title: "After Image",
  },
  orientation: {
    type: ControlType.Enum,
    title: "Orientation",
    options: ["horizontal", "vertical"],
    optionTitles: ["Horizontal", "Vertical"],
    defaultValue: "horizontal",
    displaySegmentedControl: true,
  },
  initialPosition: {
    type: ControlType.Number,
    title: "Initial Position",
    defaultValue: 50,
    min: 0,
    max: 100,
    step: 1,
    unit: "%",
  },
  dividerColor: {
    type: ControlType.Color,
    title: "Divider Color",
    defaultValue: "#FFFFFF",
  },
  dividerWidth: {
    type: ControlType.Number,
    title: "Divider Width",
    defaultValue: 2,
    min: 1,
    max: 20,
    step: 1,
    unit: "px",
  },
  dividerShadow: {
    type: ControlType.Boolean,
    title: "Divider Shadow",
    defaultValue: true,
    enabledTitle: "On",
    disabledTitle: "Off",
  },
  showHandle: {
    type: ControlType.Boolean,
    title: "Show Handle",
    defaultValue: false,
    enabledTitle: "Show",
    disabledTitle: "Hide",
  },
  handleColor: {
    type: ControlType.Color,
    title: "Handle Color",
    defaultValue: "#FFFFFF",
    hidden: ({ showHandle }) => !showHandle,
  },
  handleSize: {
    type: ControlType.Number,
    title: "Handle Size",
    defaultValue: 40,
    min: 20,
    max: 80,
    step: 1,
    unit: "px",
    hidden: ({ showHandle }) => !showHandle,
  },
});
```

## Notes (Sticky Note)

Colorful sticky note with font options.

```tsx
import { type MouseEventHandler, type CSSProperties, useMemo } from "react";
import { addPropertyControls, ControlType, RenderTarget, Color } from "framer";

const colors = {
  blue: "#0099FF",
  darkBlue: "#0066FF",
  purple: "#8855FF",
  red: "#FF5588",
  green: "#22CC66",
  yellow: "#FFBB00",
};

interface NotesProps {
  note: string;
  shadow: boolean;
  color: string;
  preview: boolean;
  alignment: "left" | "center" | "right";
  smallFont: boolean;
  onClick?: MouseEventHandler<HTMLDivElement>;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
  onMouseDown?: MouseEventHandler<HTMLDivElement>;
  onMouseUp?: MouseEventHandler<HTMLDivElement>;
  useScriptFont: boolean;
  font: CSSProperties;
}

/**
 * STICKY
 *
 * @framerIntrinsicWidth 150
 * @framerIntrinsicHeight 150
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function Notes(props: NotesProps) {
  const {
    note = "",
    shadow,
    color,
    preview,
    alignment,
    smallFont,
    onClick,
    onMouseEnter,
    onMouseLeave,
    onMouseDown,
    onMouseUp,
    useScriptFont,
    font,
  } = props;

  const [baseColorString, backgroundColorString] = useMemo(() => {
    const baseColor = Color(colors[color]);
    const hslColor = Color.toHsl(baseColor);
    hslColor.l = 0.95;

    const baseColorString = Color(colors[color]).toValue();
    const backgroundColorString = Color(hslColor).toValue();

    return [baseColorString, backgroundColorString];
  }, [color]);

  const centerAligned = alignment === "center";
  const hasContent = note.length > 0;

  return (
    <div
      style={{
        flex: 1,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: centerAligned ? "center" : "flex-start",
        backgroundColor: backgroundColorString,
        overflow: "hidden",
        paddingLeft: smallFont ? 15 : 18,
        paddingTop: useScriptFont ? 12 : 14,
        paddingBottom: useScriptFont ? 12 : 14,
        paddingRight: smallFont ? 15 : 18,
        borderRadius: 8,
        visibility:
          RenderTarget.current() === RenderTarget.preview && !preview
            ? "hidden"
            : "visible",
        ...(useScriptFont ? { fontFamily: "Nanum Pen Script" } : font),
        //@ts-ignore
        fontDisplay: "fallback",
        boxShadow: shadow ? "0 4px 10px rgba(0,0,0,0.08)" : "none",
      }}
      {...{ onClick, onMouseEnter, onMouseLeave, onMouseDown, onMouseUp }}
    >
      {useScriptFont && (
        <link
          href="https://fonts.googleapis.com/css?family=Nanum+Pen+Script&display=swap"
          rel="stylesheet"
        />
      )}
      <p
        style={{
          width: "max-content",
          wordBreak: "break-word",
          overflowWrap: "break-word",
          overflow: "hidden",
          whiteSpace: "pre-wrap",
          margin: 0,
          fontSize: smallFont
            ? useScriptFont
              ? 18
              : 12
            : useScriptFont
              ? 32
              : 24,

          lineHeight: smallFont
            ? useScriptFont
              ? 1.15
              : 1.4
            : useScriptFont
              ? 1.08
              : 1.3,
          textAlign: alignment,
          color: baseColorString,
          display: "-webkit-box",
          opacity: hasContent ? 1 : 0.5,
          WebkitBoxOrient: "vertical",
        }}
      >
        {hasContent ? note : "Write something..."}
      </p>
    </div>
  );
}

addPropertyControls(Notes, {
  note: {
    type: ControlType.String,
    displayTextArea: true,
    placeholder: `Write something… \n\n\n`,
  },
  color: {
    type: ControlType.Enum,
    defaultValue: "blue",
    options: Object.keys(colors),
    optionTitles: Object.keys(colors).map((c) =>
      c.replace(/^\w/, (c) => c.toUpperCase()),
    ),
  },

  alignment: {
    title: "Text Align",
    type: ControlType.Enum,
    displaySegmentedControl: true,
    optionTitles: ["Left", "Center", "Right"],
    options: ["left", "center", "right"],
  },
  useScriptFont: {
    type: ControlType.Boolean,
    disabledTitle: "Custom",
    enabledTitle: "Script",
    title: "Font",
    defaultTitle: true,
  },
  font: {
    type: ControlType.Font,
    defaultFontType: "sans-serif",
    controls: "extended",
    hidden: ({ useScriptFont }) => useScriptFont,
  },
  smallFont: {
    type: ControlType.Boolean,
    disabledTitle: "Big",
    enabledTitle: "Small",
    title: "Text Size",
    defaultValue: true,
  },
  preview: {
    type: ControlType.Boolean,
    defaultValue: true,
    title: "In Preview",
    enabledTitle: "Show",
    disabledTitle: "Hide",
  },
  shadow: {
    type: ControlType.Boolean,
    defaultValue: false,
    title: "Shadow",
    enabledTitle: "Show",
    disabledTitle: "Hide",
  },
});

Notes.displayName = "Sticky Note";
```

## Key Patterns Demonstrated

1. **SSR Safety**: `if (typeof window !== "undefined")` guards
2. **State Transitions**: `setState` wrapped in `startTransition()` for smooth interactions
3. **Static Renderer**: `useIsStaticRenderer()` to skip animations on canvas
4. **Image Defaults**: Set in destructuring, not in property controls
5. **Font Controls**: `controls: "extended"` with `defaultFontType: "sans-serif"` for full typography customization
6. **Conditional Controls**: `hidden: (props) => !props.showFeature`
7. **Accessibility**: `role`, `aria-*`, semantic HTML, keyboard support
8. **Color Utilities**: Using `Color` from framer for color manipulation
