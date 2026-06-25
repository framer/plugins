import { Logo } from "./Logo"

interface Props {
    description: string
}

export const HeroSection = ({ description }: Props) => (
    <div className="col-lg items-center py-[30px]">
        <Logo />
        <div className="col items-center">
            <h6>Welcome to HubSpot</h6>
            <p className="text-center text-tertiary max-w-[200px]">{description}</p>
        </div>
    </div>
)
