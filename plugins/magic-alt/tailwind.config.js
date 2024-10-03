/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class", '[data-framer-theme="dark"]'],
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
                "framer-yellow": "#FFC25A",
                "framer-blue": "#0099FF",
                "framer-green": "#00c25a",
            },
            borderColor: {
                divider: "var(--framer-color-divider)",
            },
            fontSize: {
                "2xs": "10px",
            },
            spacing: {
                30: "30px",
                15: "15px",
            },
            boxShadow: {
                "bg-image": "inset 0 0 0 1px rgba(0, 0, 0, 0.1)",
            },
            dropShadow: {
                "locale-code": "0 1px 1px rgba(0, 0, 0, 0.2)",
            },
            keyframes: {
                pulse: {
                    "0%, 100%": { opacity: "1" },
                    "50%": { opacity: "0.5" },
                },
                expand: {
                    from: { width: "0" },
                    to: { width: "100%" },
                },
            },
            animation: {
                pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                expand: "expand 0.5s ease-out forwards",
            },
        },
    },
}
