/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            backgroundColor: {
                primary: "var(--framer-color-bg)",
                secondary: "var(--framer-color-bg-secondary)",
                tertiary: "var(--framer-color-bg-tertiary)",
                tertiaryDimmedLight: "rgba(243, 243, 243, 0.75)",
                tertiaryDimmedDark: "rgba(43, 43, 43, 0.75)",
                divider: "var(--framer-color-divider)",
                tint: "var(--framer-color-tint)",
                tintDimmed: "var(--framer-color-tint-dimmed)",
                tintDark: "var(--framer-color-tint-dark)",
                blackDimmed: "rgba(0, 0, 0, 0.5)",
            },
            colors: {
                primary: "var(--framer-color-text)",
                secondary: "var(--framer-color-text-secondary)",
                tertiary: "var(--framer-color-text-tertiary)",
                inverted: "var(--framer-color-text-inverted)",
                "framer-red": "#FF3366",
            },
            borderColor: {
                divider: "var(--framer-color-divider)",
            },
            gridTemplateColumns: {
                fieldPicker: "1fr 8px 1fr",
            },
            fontSize: {
                "2xs": "10px",
            },
        },
    },
}
