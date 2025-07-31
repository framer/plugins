import { framer } from "framer-plugin"
import { useUserQuery } from "../../api"
import auth from "../../auth"
import { CenteredSpinner } from "../../components/CenteredSpinner"

export default function AccountPage() {
    const { data: user, isLoading: isLoadingUser } = useUserQuery()

    const handleLogout = () => {
        auth.logout()
        void framer.closePlugin(
            "Uninstall the Framer app from the HubSpot integrations dashboard to complete the removal"
        )
    }

    if (isLoadingUser) return <CenteredSpinner />

    if (!user) return null

    return (
        <main>
            <h6>Profile</h6>
            <div className="input-container">
                <span>User</span>
                <p>{user.user}</p>
            </div>
            <div className="input-container">
                <span>Hub ID</span>
                <p>{user.hub_id}</p>
            </div>
            <button className="framer-button-destructive w-full" onClick={handleLogout}>
                Log Out
            </button>
        </main>
    )
}
