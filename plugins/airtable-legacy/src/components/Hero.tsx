import lightHero from "../assets/hero-light.png"
import darkHero from "../assets/hero-dark.png"

export const Hero = () => (
    <img
        src={document.body.dataset.framerTheme === "light" ? lightHero : darkHero}
        alt="Airtable Hero"
        className="object-contain h-[200px] w-full"
    />
)
