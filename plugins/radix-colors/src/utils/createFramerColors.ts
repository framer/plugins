import { z } from "zod"
import { ColorName, ColorScaleStop, ColorTheme, ColorVariant } from "../types"
import { colorsScales } from "../constants"
import { framer } from "framer-plugin"

export const ColorOptions = z.object({
    name: ColorName,
    variant: ColorVariant.default("solid"),
    theme: ColorTheme.or(z.ZodEnum.create(["auto"])).default("auto"),
})
export type ColorOptions = z.infer<typeof ColorOptions>

const ColorStyleAttributes = z.object({
    name: z.string(),
    light: z.string(),
    dark: z.string().optional(),
})
export type ColorStyleAttributes = z.infer<typeof ColorStyleAttributes>

export async function createFramerColors({ name, variant, theme }: ColorOptions) {
    const colorScale = colorsScales[name][variant]

    colorScale[1].light

    for (const stop in colorScale) {
        const colorStop = colorScale[Number(stop) as ColorScaleStop]
        const isAuto = theme === "auto"

        await framer.createColorStyle({
            name: `${name}.${stop}`,
            light: isAuto ? colorStop.light : colorStop[theme],
            dark: isAuto ? colorStop.dark : undefined,
        })
    }
}
