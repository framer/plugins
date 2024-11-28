import { useAccountEngagementForms } from "@/api"
import { ScrollFadeContainer } from "@/components/ScrollFadeContainer"
import auth from "@/auth"
import { CenteredSpinner } from "@/components/CenteredSpinner"
import { InternalLink } from "@/components/Link"
import { Draggable, framer } from "framer-plugin"
import { Message } from "@/components/Message"

export default function AccountEngagementForms() {
    const { data: forms, isLoading } = useAccountEngagementForms()

    if (isLoading) return <CenteredSpinner />

    if (!forms) return null

    if (forms.length === 0) {
        return <Message title="No Forms">Create a form in Account Engagement to add it to your Framer site</Message>
    }

    return (
        <main>
            <p>
                For further customization, use{" "}
                <InternalLink href="/account-engagement-forms/handlers">form handlers</InternalLink>.
            </p>
            <ScrollFadeContainer className="col" height={161}>
                {forms.map((form, index) => (
                    <Draggable
                        key={index}
                        data={{
                            type: "componentInstance",
                            url: "https://framer.com/m/Salesforce-Form-jh2p.js",
                            attributes: {
                                controls: {
                                    html: form.embedCode,
                                },
                            },
                        }}
                    >
                        <button
                            key={index}
                            className="min-h-[30px] row items-center rounded-lg pl-[15px] pr-[15px] font-semibold text-secondary relative"
                            onClick={() =>
                                framer.addComponentInstance({
                                    url: "https://framer.com/m/Salesforce-Form-jh2p.js",
                                    attributes: {
                                        controls: {
                                            html: form.embedCode,
                                        },
                                    },
                                })
                            }
                        >
                            <p className="max-w-[190px] text-ellipsis text-nowrap overflow-hidden">{form.name}</p>
                        </button>
                    </Draggable>
                ))}
            </ScrollFadeContainer>
            <div className="col-lg sticky top-0 left-0">
                <hr />
                <button
                    className="framer-button-primary"
                    onClick={() =>
                        window.open(
                            `${auth.tokens.getOrThrow().instanceUrl}/lightning/page/pardot/form%2Fforms`,
                            "_blank"
                        )
                    }
                >
                    View Forms
                </button>
            </div>
        </main>
    )
}
