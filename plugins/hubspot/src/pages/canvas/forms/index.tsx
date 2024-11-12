import { Link } from "wouter"
import { useAccountQuery, useFormsQuery } from "@/api"
import { CenteredSpinner } from "@/components/CenteredSpinner"
import { ComponentInsert } from "@/components/ComponentInsert"

export default function FormsPage() {
    const { data: account, isLoading: isLoadingAccount } = useAccountQuery()
    const { data: formsData, isLoading: isLoadingForms } = useFormsQuery()

    const forms = formsData?.results ?? []

    if (isLoadingForms || isLoadingAccount) return <CenteredSpinner />

    if (!account) return <p className="text-tertiary">No account found</p>

    const { portalId, uiDomain, dataHostingLocation } = account

    return (
        <div className="col-lg p-[15px]">
            <p>
                Need some help? View the <Link href="/canvas/forms/installation"> installation methods</Link>.
            </p>
            {forms.length > 0 ? (
                forms.map((form, i) => (
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
                        <div key={i} className="w-full tile p-2 rounded-lg cursor-pointer">
                            <p className="truncate font-semibold text-left">{form.name}</p>
                        </div>
                    </ComponentInsert>
                ))
            ) : (
                <p className="text-tertiary text-center my-10">Create a form in HubSpot to add them to your page</p>
            )}
            <button
                className="framer-button-primary w-full"
                onClick={() => window.open(`https://${uiDomain}/forms/${portalId}`, "_blank")}
            >
                View Forms
            </button>
        </div>
    )
}
