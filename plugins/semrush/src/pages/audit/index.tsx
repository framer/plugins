import { MenuOption } from "@/components/MenuOption"
import { ChartIcon, DatabaseIcon } from "@/components/Icons"

export function AuditMenuPage() {
    return (
        <div className="col-lg items-start">
            <div className="row w-full">
                <MenuOption to="/audit/settings" title="Settings">
                    <DatabaseIcon />
                </MenuOption>
                <MenuOption to="/audit/report" title="Reports">
                    <ChartIcon />
                </MenuOption>
            </div>
        </div>
    )
}
