import { framer } from "framer-plugin"
import { useUserQuery } from "../api"
import auth from "../auth"
import { CenteredSpinner } from "../components/CenteredSpinner"

export function AccountPage() {
    const { data: user, isLoading: isLoadingUser } = useUserQuery()

    const handleLogout = () => {
        auth.tokens.clear()
        framer.closePlugin("Uninstall the Framer app from the HubSpot integrations dashboard to complete the removal")
    }

    if (isLoadingUser) return <CenteredSpinner />

    return (
        <div className="col-lg">
            <h6>Profile</h6>
            <div className="input-container">
                <span>User</span>
                <p title={user?.user}>{user?.user}</p>
            </div>
            <div className="input-container">
                <span>Hub ID</span>
                <p>{user?.hub_id}</p>
            </div>
            <button className="framer-button-destructive w-full" onClick={handleLogout}>
                Logout
            </button>
        </div>
    )
}
