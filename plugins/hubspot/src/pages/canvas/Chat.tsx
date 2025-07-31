import { framer, useIsAllowedTo } from "framer-plugin"
import { useEffect, useState } from "react"
import * as v from "valibot"
import { Link } from "wouter"
import { useAccountQuery, useInboxesQuery } from "../../api"
import { CenteredSpinner } from "../../components/CenteredSpinner"
import { SegmentedControls } from "../../components/SegmentedControls"

const EnableWidgetCookieBannerSchema = v.union([v.boolean(), v.literal("ON_EXIT_INTENT")])
const DisableAttachmentSchema = v.boolean()

const SettingsSchema = v.object({
    enableWidgetCookieBanner: EnableWidgetCookieBannerSchema,
    disableAttachment: DisableAttachmentSchema,
})

export default function ChatPage() {
    const [hasSetExistingSettings, setHasSetExistingSettings] = useState(false)
    const [settings, setSettings] = useState<v.InferOutput<typeof SettingsSchema>>({
        enableWidgetCookieBanner: false,
        disableAttachment: false,
    })
    const { data: account, isLoading: isLoadingAccount } = useAccountQuery()
    const { data: inboxes, isLoading: isLoadingInboxes } = useInboxesQuery()

    const isAllowedToSetCustomCode = useIsAllowedTo("setCustomCode")

    useEffect(() => {
        async function checkExistingSettings() {
            const customCode = await framer.getCustomCode()
            const existingHTML = customCode.bodyStart.html

            const matches = /window\.hsConversationsSettings\s*=\s*(\{.*?\});/.exec(existingHTML ?? "")
            if (matches?.[1]) {
                setSettings(v.parse(SettingsSchema, JSON.parse(matches[1])))
            }

            setHasSetExistingSettings(true)
        }

        void checkExistingSettings()
    }, [])

    useEffect(() => {
        if (!isAllowedToSetCustomCode) return

        async function applySettings() {
            const customCode = await framer.getCustomCode()
            const existingHTML = customCode.bodyStart.html

            if (!hasSetExistingSettings || existingHTML === null) return

            const settingsScript = `<script>window.hsConversationsSettings = ${JSON.stringify(settings)};</script>`

            if (!existingHTML.includes(settingsScript)) {
                await framer.setCustomCode({
                    html: settingsScript,
                    location: "bodyStart",
                })
            }
        }

        void applySettings()
    }, [settings, hasSetExistingSettings, isAllowedToSetCustomCode])

    if (isLoadingAccount || isLoadingInboxes) return <CenteredSpinner />

    if (!account || !inboxes) return null

    return (
        <main>
            <p>
                Ensure
                <Link to="/canvas/tracking"> tracking </Link>
                is enabled.
            </p>
            <h6>Inboxes</h6>
            {inboxes.length > 0 ? (
                inboxes.map((inbox, i) => (
                    <div className="input-container" key={i}>
                        <span>{inbox.name}</span>
                        <a
                            target="_blank"
                            title={inbox.name}
                            href={`https://app.hubspot.com/live-messages-settings/${account.portalId}/inboxes/${inbox.id}/edit/live-chat/primary/configure`}
                        >
                            Open
                        </a>
                    </div>
                ))
            ) : (
                <p className="text-tertiary text-center max-w-[200px] m-auto">
                    Create an inbox in HubSpot to view it here
                </p>
            )}
            <hr />
            <h6>Settings</h6>
            <div className="input-container">
                <label htmlFor="enableWidgetCookieBanner">Banner</label>
                <select
                    name="enableWidgetCookieBanner"
                    id="enableWidgetCookieBanner"
                    value={JSON.stringify(settings.enableWidgetCookieBanner)}
                    onChange={value => {
                        setSettings({
                            ...settings,
                            enableWidgetCookieBanner: v.parse(
                                EnableWidgetCookieBannerSchema,
                                JSON.parse(value.target.value)
                            ),
                        })
                    }}
                    disabled={!isAllowedToSetCustomCode}
                    title={isAllowedToSetCustomCode ? undefined : "Insufficient permissions"}
                    className={isAllowedToSetCustomCode ? undefined : "opacity-50"}
                >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                    {/* The double quotes are intentional, as these values are the output of JSON.stringify */}
                    <option value='"ON_EXIT_INTENT"'>On Exit Intent</option>
                </select>
            </div>
            <div className="input-container">
                <label htmlFor="disableAttachment">Attachment</label>
                <SegmentedControls
                    name="disableAttachment"
                    options={[
                        { value: "false", label: "Show" },
                        { value: "true", label: "Hide" },
                    ]}
                    value={JSON.stringify(settings.disableAttachment)}
                    onValueChange={value => {
                        setSettings({
                            ...settings,
                            disableAttachment: v.parse(DisableAttachmentSchema, JSON.parse(value)),
                        })
                    }}
                    disabled={!isAllowedToSetCustomCode}
                    title={isAllowedToSetCustomCode ? undefined : "Insufficient permissions"}
                />
            </div>
            <hr />
            <button
                className="framer-button-primary w-full"
                onClick={() => {
                    window.open(`https://app-eu1.hubspot.com/chatflows/${account.portalId}/`, "_blank")
                }}
            >
                View Chatflows
            </button>
        </main>
    )
}
