import { useAccountQuery, useMeetingsQuery } from "../api"
import { CenteredSpinner } from "../components/CenteredSpinner"
import { ComponentInsert } from "../components/ComponentInsert"

export function MeetingsPage() {
    const { data: account, isLoading: isLoadingAccount } = useAccountQuery()
    const { data: meetingsData, isLoading: isLoadingMeetings } = useMeetingsQuery()

    const meetings = meetingsData?.results ?? []

    if (isLoadingAccount || isLoadingMeetings) return <CenteredSpinner />

    if (!account) return <p className="text-tertiary">No account found</p>

    const { uiDomain, portalId } = account

    return (
        <div className="col-lg">
            {meetings.length > 0 ? (
                meetings.map((meeting, i) => (
                    <ComponentInsert
                        key={i}
                        url="https://framer.com/m/HubSpot-Meeting-ovhV.js"
                        attributes={{
                            controls: {
                                link: meeting.link,
                            },
                        }}
                    >
                        <div key={i} className="w-full tile p-2 rounded-lg cursor-pointer">
                            <p className="truncate font-semibold text-left">{meeting.name}</p>
                        </div>
                    </ComponentInsert>
                ))
            ) : (
                <p className="text-tertiary text-center my-10">Create a meeting in HubSpot to add them to your page</p>
            )}
            <button
                className="framer-button-primary w-full"
                onClick={() => window.open(`https://${uiDomain}/meetings/${portalId}`, "_blank")}
            >
                View Meetings
            </button>
        </div>
    )
}
