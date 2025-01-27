import { framer } from "framer-plugin"
import { useState } from "react"
import { request, useMessagingEmbeddedServices, useOrgQuery, useUserQuery } from "@/api"
import { CenteredSpinner } from "@/components/CenteredSpinner"
import { ScrollFadeContainer } from "@/components/ScrollFadeContainer"
import auth from "@/auth"
import { Message } from "@/components/Message"

interface BuildEmbedScriptParams {
    instanceUrl: string
    orgId: string
    durableId: string
    urlPathPrefix: string
    languageLocaleKey: string
}

const buildEmbedScript = ({
    instanceUrl,
    orgId,
    durableId,
    urlPathPrefix,
    languageLocaleKey,
}: BuildEmbedScriptParams) => `<script type='text/javascript'>
	function initEmbeddedMessaging() {
		try {
			embeddedservice_bootstrap.settings.language = '${languageLocaleKey}';

			embeddedservice_bootstrap.init(
				'${orgId.slice(0, -3)}',
				'${durableId}',
				'${instanceUrl}/${urlPathPrefix}',
				{
					scrt2URL: '${instanceUrl.replace(".salesforce.com", ".salesforce-scrt.com")}'
				}
			);
		} catch (err) {
			console.error('Error loading Embedded Messaging: ', err);
		}
	};
</script>
<script type='text/javascript' src='https://framer2-dev-ed.develop.my.site.com/${urlPathPrefix}/assets/js/bootstrap.min.js' onload='initEmbeddedMessaging()'></script>
`

export default function Messaging() {
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
    const { data: embeds, isLoading: isLoadingMessaging } = useMessagingEmbeddedServices()
    const { data: user, isLoading: isLoadingUser } = useUserQuery()
    const { data: org, isLoading: isLoadingorg } = useOrgQuery(user?.organization_id || "")

    if (isLoadingMessaging || isLoadingUser || isLoadingorg) return <CenteredSpinner />

    if (!embeds || !user || !org) return null

    const handleCopyEmbed = async (copyIndex: number, siteId: string, durableId: string) => {
        setCopiedIndex(copyIndex)

        try {
            const site = await request<{ Id: string; Name: string; UrlPathPrefix: string }>({
                path: `/sobjects/Site/${siteId}`,
            })

            await navigator.clipboard.writeText(
                buildEmbedScript({
                    instanceUrl: auth.tokens.getOrThrow().instanceUrl,
                    orgId: user.organization_id,
                    durableId: durableId,
                    urlPathPrefix: site.UrlPathPrefix,
                    languageLocaleKey: org.LanguageLocaleKey,
                })
            )
        } catch {
            framer.notify("Something went wrong fetching site data", { variant: "error" })
        }

        setTimeout(() => setCopiedIndex(null), 1000)

        framer.notify("Paste the embed at the end of the <body> tag on the pages where you want it to appear")
    }

    if (embeds.length === 0) {
        return (
            <Message title="No Embeds">Create an embedded service in Salesforce to add it to your Framer site"</Message>
        )
    }

    return (
        <div className="flex flex-col gap-0 p-[15px]">
            <div className="flex pb-[15px] border-b border-divider">
                <p className="flex-grow">Chat</p>
                <p className="w-[62px]">Embed</p>
            </div>
            <ScrollFadeContainer className="col py-[15px]" height={209}>
                {embeds.map((service, i) => {
                    const name = service.DurableId.replace(/_/g, " ")

                    return (
                        <div className="row items-center min-h-[30px]" key={i}>
                            <p
                                className="flex-1 text-ellipsis overflow-hidden text-nowrap text-primary w-[148px]"
                                title={name}
                            >
                                {name}
                            </p>
                            <button
                                className="w-[62px]"
                                onClick={() => handleCopyEmbed(i, service.Site, service.DurableId)}
                            >
                                {copiedIndex === i ? "Copied" : "Copy"}
                            </button>
                        </div>
                    )
                })}
            </ScrollFadeContainer>
            <div className="col-lg sticky top-0 left-0">
                <hr />
                <button
                    className="framer-button-primary"
                    onClick={() =>
                        window.open(
                            `${auth.tokens.getOrThrow().instanceUrl}/lightning/setup/EmbeddedServiceDeployments/home`,
                            "_blank"
                        )
                    }
                >
                    View Embeds
                </button>
            </div>
        </div>
    )
}
