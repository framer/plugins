import Calendar from "../assets/Calendar.png"
import { ComponentInsert } from "../components/ComponentInsert"

export function WidgetsPage() {
    return (
        <div className="grid grid-cols-2 gap-2.5">
            <ComponentInsert url="https://framer.com/m/HubSpot-Plugin-nyBq.js">
                <div className="flex flex-col items-center justify-cente h-[110px] rounded-md tile cursor-pointer">
                    <img src={Calendar} alt="HubSpot meeting widget" />
                    <p className="text-[11px] text-tertiary">Scheduler</p>
                </div>
            </ComponentInsert>
        </div>
    )
}
