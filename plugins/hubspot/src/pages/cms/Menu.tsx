import { DatabaseIcon, FormsIcon } from "../../components/Icons"
import { MenuOption } from "../../components/MenuOption"

export default function MenuPage() {
    return (
        <div className="col-lg p-[15px]">
            <div className="grid grid-cols-2 gap-2.5">
                <MenuOption title="Blog" to="/cms/blog" icon={<FormsIcon />} />
                <MenuOption title="HubDB" to="/cms/hubdb" icon={<DatabaseIcon />} />
            </div>
        </div>
    )
}
