import { MenuOption } from "@/components/MenuOption"
import { ChartIcon, DatabaseIcon, SearchIcon } from "@/components/Icons"
import { usePrefetchAuditQuery } from "@/api"

export function MenuPage() {
    const prefetchAudit = usePrefetchAuditQuery()

    return (
        <div className="col-lg">
            <p className="text-tertiary">Welcome! Research keywords, audit your site and improve your SEO.</p>
            <div className="col-lg items-start">
                <div className="row w-full">
                    <MenuOption to="/keywords" title="Search">
                        <SearchIcon />
                    </MenuOption>
                    <MenuOption to="/audit" title="Audit" onClick={() => prefetchAudit()}>
                        <ChartIcon />
                    </MenuOption>
                </div>
                <div className="row w-full">
                    <MenuOption to="/project" title="Project">
                        <DatabaseIcon />
                    </MenuOption>
                </div>
            </div>
        </div>
    )
}
