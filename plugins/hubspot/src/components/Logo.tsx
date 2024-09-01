import lightLogo from "../assets/HubSpotLight.svg"
import darkLogo from "../assets/HubSpotDark.svg"
import { useDarkMode } from "usehooks-ts"

export const Logo = () => {
    const { isDarkMode } = useDarkMode()

    return <img src={isDarkMode ? darkLogo : lightLogo} width={30} height={30} draggable="false" />
}
