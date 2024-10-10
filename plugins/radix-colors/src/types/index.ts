import { z } from "zod"

const HexColor = z.string().regex(/^#[0-9a-f]{6}$/i)
type HexColor = z.infer<typeof HexColor>

export const colorVariants = ["solid", "alpha"] as const
export const ColorVariant = z.enum(colorVariants)
export type ColorVariant = z.infer<typeof ColorVariant>

export const colorThemes = ["light", "dark", "auto"] as const
export const ColorTheme = z.enum(colorThemes)
export type ColorTheme = z.infer<typeof ColorTheme>

const colorScaleStops = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const
export type ColorScaleStop = (typeof colorScaleStops)[number]

type ColorStop = Record<Exclude<ColorTheme, "auto">, HexColor>
type ColorScale = Record<ColorVariant, Record<ColorScaleStop, ColorStop>>
export type ColorScales = Record<ColorName, ColorScale>

const colorNames = [
    "gray",
    "mauve",
    "slate",
    "sage",
    "olive",
    "sand",
    "gold",
    "bronze",
    "brown",
    "yellow",
    "amber",
    "orange",
    "tomato",
    "red",
    "ruby",
    "crimson",
    "pink",
    "plum",
    "purple",
    "violet",
    "iris",
    "indigo",
    "blue",
    "cyan",
    "teal",
    "jade",
    "green",
    "grass",
    "lime",
    "mint",
    "sky",
] as const
export const ColorName = z.enum(colorNames)
export type ColorName = z.infer<typeof ColorName>
