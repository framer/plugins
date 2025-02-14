import { framer } from "framer-plugin"
import { Row } from "./components/Row"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { ColorOptions, createFramerColors } from "./utils/createFramerColors"
import { colorNamesByCategory } from "./utils/colorOptions"
import { colorThemes, colorVariants } from "./types"
import { slugToTitle } from "./utils/common"

import "./App.css"

framer.showUI({
    position: "top right",
    width: 240,
    height: 210,
})

export function App() {
    const {
        register,
        handleSubmit,
        formState: { isSubmitting, errors },
    } = useForm<ColorOptions>({
        defaultValues: { name: "gray", variant: "solid", theme: "auto" },
        resolver: zodResolver(ColorOptions),
    })

    const generateColor = async (options: ColorOptions) => {
        try {
            await createFramerColors(options)
            framer.notify(`${slugToTitle(options.name)} scale has been generated.`, {
                durationMs: 3000,
                variant: "success",
            })
        } catch (error) {
            framer.notify("Failed to generate color.", {
                durationMs: 3000,
                variant: "error",
            })
            console.error(error)
        }
    }

    return (
        <form onSubmit={handleSubmit(generateColor)}>
            <main>
                <Row title="Color">
                    <select id="name" {...register("name")}>
                        {colorNamesByCategory.map(category => (
                            <optgroup key={category.id} label={category.label}>
                                {category.colors.map(color => (
                                    <option key={color} value={color}>
                                        {slugToTitle(color)}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </Row>

                <Row title="Variant">
                    <select id="variant" {...register("variant")}>
                        {colorVariants.map(variant => (
                            <option key={variant} value={variant}>
                                {slugToTitle(variant)}
                            </option>
                        ))}
                    </select>
                </Row>

                <Row title="Theme">
                    <select id="theme" {...register("theme")}>
                        {colorThemes.map(theme => (
                            <option key={theme} value={theme}>
                                {slugToTitle(theme)}
                            </option>
                        ))}
                    </select>
                </Row>

                {errors.name && <p>{errors.name.message}</p>}

                <button className="framer-button-primary" disabled={isSubmitting}>
                    Generate
                </button>

                <p>
                    Learn more on{" "}
                    <a href="https://www.radix-ui.com/colors" target="_blank" rel="noopener noreferrer">
                        Radix Colors
                    </a>
                    .
                </p>
            </main>
        </form>
    )
}
