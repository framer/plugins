import { Link } from "wouter"
import { useAccountQuery, useFormsQuery } from "@/api"
import { CenteredSpinner } from "@/components/CenteredSpinner"
import { ComponentInsert } from "@/components/ComponentInsert"
import { ScrollFadeContainer } from "@/components/ScrollFadeContainer"

export default function FormsPage() {
    const { data: account, isLoading: isLoadingAccount } = useAccountQuery()
    const { data: forms, isLoading: isLoadingForms } = useFormsQuery()

    if (isLoadingForms || isLoadingAccount) return <CenteredSpinner />

    if (!account || !forms) return null

    const { portalId, uiDomain, dataHostingLocation } = account

    return (
        <div className="flex flex-col gap-0 h-full p-[15px]">
            <p>
                Need some help? View the <Link href="/canvas/forms/installation"> installation methods</Link>.
            </p>
            {forms.length > 0 ? (
                <ScrollFadeContainer className="col py-[15px]" height={191}>
                    {forms.map((form, i) => (
                        <ComponentInsert
                            key={i}
                            url="https://framer.com/m/HubSpot-Form-qRu7.js"
                            attributes={{
                                controls: {
                                    portalId: String(portalId),
                                    formId: form.id,
                                    dataHostingLocation,
                                },
                            }}
                        >
                            {form.name}
                        </ComponentInsert>
                    ))}
                </ScrollFadeContainer>
            ) : (
                <div className="flex justify-center items-center h-[191px]">
                    <p className="text-tertiary text-center max-w-[200px]">
                        Create a form in HubSpot to add it to your page
                    </p>
                </div>
            )}

            <div className="col-lg sticky top-0 left-0 pb-[15px]">
                <hr />
                <button
                    className="framer-button-primary"
                    onClick={() => window.open(`https://${uiDomain}/forms/${portalId}`, "_blank")}
                >
                    View Forms
                </button>
            </div>
        </div>
    )
}
