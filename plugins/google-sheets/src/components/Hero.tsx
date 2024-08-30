import hero from "../assets/hero.png"

export const Hero = () => (
    <div className="h-[200px] flex justify-center bg-[#00BD42] bg-opacity-[0.08] rounded-[10px]">
        <img src={hero} alt="Floating sheet" className="object-contain" />
    </div>
)
