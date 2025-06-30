import hero from "../assets/hero.png"

export const Hero = () => (
    <div className="min-h-[200px] flex items-center justify-center bg-[rgba(0,189,66,0.08)] rounded-[10px]">
        <img src={hero} alt="Floating sheet" className="object-contain w-[160px] h-[160px]" />
    </div>
)
