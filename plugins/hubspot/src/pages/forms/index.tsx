import { Link } from "wouter"
import { useAccountQuery, useFormsQuery } from "../../api"
import { CenteredSpinner } from "../../components/CenteredSpinner"
import { ComponentInsert } from "../../components/ComponentInsert"

const buildFormScript = (portalId: number, dataHostingLocation: string, formId: string) => {
    return `
    <script charset="utf-8" type="text/javascript" src="//js-${dataHostingLocation}.hsforms.net/forms/embed/v2.js"></script>
    <script>
      hbspt.forms.create({
        region: "${dataHostingLocation}",
        portalId: "${portalId}",
        formId: "${formId}",
      });
    </script>
  `
}

export function FormsPage() {
    const { data: account, isLoading: isLoadingAccount } = useAccountQuery()
    const { data: formsData, isLoading: isLoadingForms } = useFormsQuery()

    const forms = formsData?.results ?? []

    if (isLoadingForms || isLoadingAccount) return <CenteredSpinner />

    if (!account) return <p className="text-tertiary">No account found</p>

    const { portalId, uiDomain, dataHostingLocation } = account

    return (
        <div className="col-lg">
            <p>
                Need some help? View the <Link href="/forms/installation"> installation methods</Link>.
            </p>
            {forms.length > 0 ? (
                forms.map((form, i) => (
                    <ComponentInsert
                        key={i}
                        url="https://framer.com/m/Embed-UI5d.js"
                        attributes={{
                            controls: {
                                type: "html",
                                html: buildFormScript(portalId, dataHostingLocation, form.id),
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
