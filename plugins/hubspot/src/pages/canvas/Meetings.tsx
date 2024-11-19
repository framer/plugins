import { useAccountQuery, useMeetingsQuery } from "@/api"
import { CenteredSpinner } from "@/components/CenteredSpinner"
import { ComponentInsert } from "@/components/ComponentInsert"
import { ScrollFadeContainer } from "@/components/ScrollFadeContainer"

export default function MeetingsPage() {
    const { data: account, isLoading: isLoadingAccount } = useAccountQuery()
    const { data: meetings, isLoading: isLoadingMeetings } = useMeetingsQuery()

    if (isLoadingAccount || isLoadingMeetings) return <CenteredSpinner />

    if (!account || !meetings) return null

    const { uiDomain, portalId } = account

    return (
        <div className="flex flex-col gap-0 h-full p-[15px]">
            {meetings.length > 0 ? (
                <ScrollFadeContainer className="col pb-[15px]" height={226}>
                    {meetings.map((meeting, i) => (
                        <ComponentInsert
                            key={i}
                            url="https://framer.com/m/HubSpot-Meeting-ovhV.js"
                            attributes={{
                                controls: {
                                    link: meeting.link,
                                },
                            }}
                        >
                            {meeting.name}
                        </ComponentInsert>
                    ))}
                </ScrollFadeContainer>
            ) : (
                <div className="flex justify-center items-center h-[226px]">
                    <p className="text-tertiary text-center max-w-[200px]">
                        Create a meeting in HubSpot to add it to your page
                    </p>
                </div>
            )}

            <div className="col-lg sticky top-0 left-0">
                <hr />
                <button
                    className="framer-button-primary"
                    onClick={() => window.open(`https://${uiDomain}/meetings/${portalId}`, "_blank")}
                >
                    View Meetings
                </button>
            </div>
        </div>
    )
}
