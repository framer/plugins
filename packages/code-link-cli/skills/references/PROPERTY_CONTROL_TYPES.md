# Framer Property Control Types

TypeScript interfaces for all Framer property control types. For usage documentation and examples, see [Property Controls](PROPERTY_CONTROLS.md).

## Base Control Description

All control descriptions extend this base interface:

```typescript
export interface BaseControlDescription<P = any> {
  title?: string;
  description?: string;
  hidden?: ((props: P, rootProps: any) => boolean) | boolean;
}

export interface WithOptional {
  optional?: boolean;
}
```

## Control Type Interfaces

### Boolean Control

```typescript
export interface BooleanControlDescription<P = any>
  extends BaseControlDescription<P>, WithOptional {
  type: ControlType.Boolean;
  defaultValue?: boolean;
  /** @deprecated */
  disabledTitle?: string;
  /** @deprecated */
  enabledTitle?: string;
}
```

### Number Control

```typescript
export interface NumberControlDescription<P = any>
  extends BaseControlDescription<P>, WithOptional {
  type: ControlType.Number;
  defaultValue?: number;
  max?: number;
  min?: number;
  unit?: string;
  step?: number;
  displayStepper?: boolean;
}
```

### String Control

```typescript
export interface StringControlDescription<P = any>
  extends BaseControlDescription<P>, WithOptional {
  type: ControlType.String;
  defaultValue?: string;
  placeholder?: string;
  obscured?: boolean;
  displayTextArea?: boolean;
  preventLocalization?: boolean;
}
```

### Enum Control

```typescript
export interface EnumControlDescription<
  P = any,
> extends BaseControlDescription<P> {
  type: ControlType.Enum;
  defaultValue?: string | boolean | number | null;
  options: (string | boolean | number | null)[];
  optionTitles?: string[];
  displaySegmentedControl?: boolean;
  segmentedControlDirection?: "horizontal" | "vertical";
}
```

### Color Control

```typescript
export interface ColorControlDescription<P = any>
  extends BaseControlDescription<P>, WithOptional {
  type: ControlType.Color;
  defaultValue?: string;
}
```

### ResponsiveImage Control

```typescript
export interface ResponsiveImageControlDescription<
  P = any,
> extends BaseControlDescription<P> {
  type: ControlType.ResponsiveImage;
}
```

### File Control

```typescript
export type AllowedFileTypes = readonly string[];

export interface FileControlDescription<
  P = any,
> extends BaseControlDescription<P> {
  type: ControlType.File;
  allowedFileTypes: AllowedFileTypes;
}
```

### Slot Control

```typescript
export interface SlotControlDescription<
  P = any,
> extends BaseControlDescription<P> {
  type: ControlType.Slot;
  maxCount?: number;
}
```

### Array Control

```typescript
export interface ArrayControlDescription<
  P = any,
> extends BaseControlDescription<P> {
  type: ControlType.Array;
  control: ArrayItemControlDescription<P>;
  minCount?: number;
  maxCount?: number;
  defaultValue?: any[];
}
```

### Object Control

```typescript
export type ObjectControlIcon =
  | "object"
  | "effect"
  | "color"
  | "interaction"
  | "boolean";

export interface ObjectControlDescription<P = any>
  extends BaseControlDescription<P>, WithOptional {
  type: ControlType.Object;
  controls: { [key: string]: ObjectPropertyControlDescription };
  defaultValue?: { [key: string]: any };
  buttonTitle?: string;
  icon?: ObjectControlIcon;
}
```

### Event Handler Control

```typescript
export interface EventHandlerControlDescription<
  P = any,
> extends BaseControlDescription<P> {
  type: ControlType.EventHandler;
}
```

### Transition Control

```typescript
import type { Transition } from "framer-motion";

export interface TransitionControlDescription<
  P = any,
> extends BaseControlDescription<P> {
  type: ControlType.Transition;
  defaultValue?: null | Transition;
}
```

### BoxShadow Control

```typescript
export interface BoxShadowControlDescription<
  P = any,
> extends BaseControlDescription<P> {
  type: ControlType.BoxShadow;
  defaultValue?: string | readonly BoxShadow[];
}
```

### Link Control

```typescript
export interface LinkControlDescription<
  P = any,
> extends BaseControlDescription<P> {
  type: ControlType.Link;
  defaultValue?: string;
}
```

### Date Control

```typescript
export interface DateControlDescription<P = any>
  extends BaseControlDescription<P>, WithOptional {
  type: ControlType.Date;
  displayTime?: boolean;
  defaultValue?: string;
}
```

### Border Control

```typescript
export type BorderStyle = "solid" | "dashed" | "dotted" | "double";

export interface Border {
  borderColor?: string;
  borderStyle?: BorderStyle;
  borderWidth?: number;
  borderTopWidth?: number;
  borderLeftWidth?: number;
  borderRightWidth?: number;
  borderBottomWidth?: number;
}

export interface BorderControlDescription<P = any>
  extends BaseControlDescription<P>, WithOptional {
  type: ControlType.Border;
  defaultValue?: Border;
}
```

### Cursor Control

```typescript
export interface CursorControlDescription<
  P = any,
> extends BaseControlDescription<P> {
  type: ControlType.Cursor;
  defaultValue?: string;
}
```

### Padding Control

```typescript
export interface PaddingControlDescription<
  P = any,
> extends BaseControlDescription<P> {
  type: ControlType.Padding;
  defaultValue?: string;
}
```

### Border Radius Control

```typescript
export interface BorderRadiusControlDescription<
  P = any,
> extends BaseControlDescription<P> {
  type: ControlType.BorderRadius;
  defaultValue?: string;
}
```

### Gap Control

```typescript
export interface GapControlDescription<
  P = any,
> extends BaseControlDescription<P> {
  type: ControlType.Gap;
  defaultValue?: string;
}
```

### Tracking ID Control

```typescript
export interface TrackingIdControlDescription<
  P = any,
> extends BaseControlDescription<P> {
  type: ControlType.TrackingId;
  defaultValue?: string;
}
```

### Font Control

```typescript
interface FontControlDescriptionBase<
  P = any,
> extends BaseControlDescription<P> {
  type: ControlType.Font;
  controls?: "basic" | "extended";
  displayTextAlignment?: boolean;
  displayFontSize?: boolean;
  defaultValue?: FontControlDefaultValueBase;
}

interface FontControlDescriptionSansSerif<
  P = any,
> extends FontControlDescriptionBase<P> {
  defaultFontType?: "sans-serif";
  defaultValue?: FontControlDefaultValueWithVariant;
}

interface FontControlDescriptionSerif<
  P = any,
> extends FontControlDescriptionBase<P> {
  defaultFontType?: "serif";
  defaultValue?: FontControlDefaultValueBase;
}

interface FontControlDescriptionMonospace<
  P = any,
> extends FontControlDescriptionBase<P> {
  defaultFontType?: "monospace";
  defaultValue?: FontControlDefaultValueBase;
}

export type FontControlDescription<P = any> =
  | FontControlDescriptionSansSerif<P>
  | FontControlDescriptionSerif<P>
  | FontControlDescriptionMonospace<P>;

interface FontControlDefaultValueBase {
  textAlign?: "left" | "right" | "center" | "justify";
  fontSize?: string | number;
  letterSpacing?: string | number;
  lineHeight?: string | number;
}

interface FontControlDefaultValueWithVariant extends FontControlDefaultValueBase {
  variant?: FramerFontVariant;
}

export const framerFontVariants = [
  "Regular",
  "Thin",
  "Extra Light",
  "Light",
  "Medium",
  "Semibold",
  "Bold",
  "Extra Bold",
  "Black",
  "Thin Italic",
  "Extra Light Italic",
  "Light Italic",
  "Italic",
  "Medium Italic",
  "Semibold Italic",
  "Bold Italic",
  "Extra Bold Italic",
  "Black Italic",
  "Regular Italic",
  "Variable",
  "Variable Italic",
] as const;

export type FramerFontVariant = (typeof framerFontVariants)[number];
```

## Composite Types

### All Control Types

```typescript
export type ControlDescription<P = any> =
  | NumberControlDescription<P>
  | EnumControlDescription<P>
  | BooleanControlDescription<P>
  | StringControlDescription<P>
  | ColorControlDescription<P>
  | ResponsiveImageControlDescription<P>
  | FileControlDescription<P>
  | SlotControlDescription<P>
  | ArrayControlDescription<P>
  | EventHandlerControlDescription<P>
  | TransitionControlDescription<P>
  | BoxShadowControlDescription<P>
  | LinkControlDescription<P>
  | DateControlDescription<P>
  | ObjectControlDescription<P>
  | FontControlDescription<P>
  | BorderControlDescription<P>
  | CursorControlDescription<P>
  | PaddingControlDescription<P>
  | BorderRadiusControlDescription<P>
  | GapControlDescription<P>
  | TrackingIdControlDescription<P>;
```

### Property Controls

```typescript
export type PropertyControls<ComponentProps = any, ArrayTypes = any> = {
  [K in keyof ComponentProps]?: ControlDescription<Partial<ComponentProps>>;
};
```

## Associated Methods and Types

### addPropertyControls

```typescript
export declare function addPropertyControls<Props = any>(
  component:
    | React.ComponentType<Props>
    | React.ForwardRefExoticComponent<Props>,
  propertyControls: PropertyControls<Props>,
): void;
```

### addFonts

```typescript
export declare function addFonts(
  component: React.ComponentType<unknown>,
  fonts: any[],
  flags?: { supportsExplicitInterCodegen?: boolean },
): void;
```

### Data API

```typescript
export declare const Data: {
  <T extends object = object>(initial?: Partial<T> | object): T;
};
```

### Renderer Detection APIs

```typescript
export declare type RenderTarget = RenderTargetName;

export declare const RenderTarget: {
  canvas: RenderTargetName;
  export: RenderTargetName;
  thumbnail: RenderTargetName;
  preview: RenderTargetName;
  current: () => RenderTargetName;
  hasRestrictions: () => boolean;
};

/** Check if executed in a Framer Canvas or Export Canvas environment */
export declare function isStaticRenderer(): boolean;

/** Hook to check if in a static renderer (Canvas or Export) */
export declare function useIsStaticRenderer(): boolean;

/** Hook to observe data changes */
export declare function useObserveData(): boolean;
```

### Color Interface and Utilities

```typescript
export interface Color {
  r: number;
  g: number;
  b: number;
  h: number;
  s: number;
  l: number;
  a: number;
  roundA: number;
  format: ColorFormat;
  initialValue?: string;
  isValid?: boolean;
  mix: any;
  toValue: () => string;
}

export enum ColorFormat {
  RGB = "rgb",
  HSL = "hsl",
  HSV = "hsv",
  HEX = "hex",
  NAME = "name",
}
```
