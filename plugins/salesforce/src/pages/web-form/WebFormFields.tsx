import { useSearchParams } from "@/hooks/useSearchParams"
import { useObjectConfigQuery } from "@/api"
import { Button } from "@/components/Button"
import { IconChevron } from "@/components/Icons"
import { ScrollFadeContainer } from "@/components/ScrollFadeContainer"
import { CenteredSpinner } from "@/components/CenteredSpinner"
import auth from "@/auth"
import { Message } from "@/components/Message"
import { PluginError } from "@/PluginError"

export default function WebFormFields() {
    const params = useSearchParams()
    const objectName = params.get("objectName")
    const { data: objectConfig, isLoading } = useObjectConfigQuery(objectName || "")

    if (isLoading) return <CenteredSpinner />

    if (!objectName) {
        throw new PluginError("Invalid Params", "Expected 'objectName' params")
    }

    if (!objectConfig) return null

    const availableFormFields = objectConfig.fields.filter(
        field =>
            !field.name.toLowerCase().includes("utm_") && // Exclude GA fields
            !field.name.toLowerCase().startsWith("pi__") && // Exclude AE fields
            !field.name.toLowerCase().includes("pardot") // More AE fields (fka Pardot)
    )

    if (availableFormFields.length === 0) {
        return <Message title="No Form Fields">This object does not have any configurable form fields</Message>
    }

    return (
        <div className="flex flex-col gap-0 p-[15px]">
            <div className="flex gap-7 pb-2.5">
                <p className="flex-1 text-tertiary">Name</p>
                <p className="flex-1 text-tertiary">API Name</p>
            </div>
            <ScrollFadeContainer className="col pb-[15px]" height={241}>
                {availableFormFields?.map((field, i) => (
                    <div className="row items-center" key={i}>
                        <input type="text" className="flex-1 w-full" value={field.label} readOnly />
                        <IconChevron />
                        <input type="text" className="flex-1 w-full" value={field.name} readOnly />
                    </div>
                ))}
            </ScrollFadeContainer>
            <div className="col-lg sticky top-0 left-0">
                <hr />
                <Button
                    onClick={() =>
                        window.open(
                            `${auth.tokens.getOrThrow().instanceUrl}/lightning/setup/ObjectManager/${objectName}/Details/view`,
                            "_blank"
                        )
                    }
                >
                    {" "}
                    View Object
                </Button>
            </div>
        </div>
    )
}
