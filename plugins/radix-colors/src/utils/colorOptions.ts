import { ColorName } from "../types"

type ColorCategory = {
    id: string
    label: string
    colors: ColorName[]
}

export const colorNamesByCategory: ColorCategory[] = [
    {
        id: "grays",
        label: "Grays",
        colors: ["gray", "mauve", "slate", "sage", "olive", "sand"],
    },
    {
        id: "colors",
        label: "Colors",
        colors: [
            "brown",
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
        ],
    },
    {
        id: "bright",
        label: "Bright Colors",
        colors: ["sky", "mint", "lime", "yellow", "amber"],
    },
    {
        id: "metals",
        label: "Metals",
        colors: ["gold", "bronze"],
    },
]
