import { CopyInput } from "@/components/CopyInput"
import { useSearchParams } from "@/hooks/useSearchParams"
import { useWebFormWebhookQuery } from "@/api"
import { Button } from "@/components/Button"
import { InternalLink } from "@/components/Link"
import auth from "@/auth"
import { BACKEND_URL } from "@/constants"
import { PluginError } from "@/PluginError"

export default function WebForm() {
    const params = useSearchParams()
    const objectName = params.get("objectName")
    const objectLabel = params.get("objectLabel")

    const { data: form, isLoading } = useWebFormWebhookQuery(objectName || "")

    if (!objectName || !objectLabel) {
        throw new PluginError("Invalid Params", "Expected 'objectName' and 'objectLabel' query params")
    }

    return (
        <main>
            <p>
                Create a Framer form with field names matching the object's fields, then add the webhook URL below. See{" "}
                <InternalLink
                    href={`/web-form/fields?objectName=${objectName}&objectLabel=${objectLabel}`}
                    state={{ title: objectLabel }}
                >
                    available fields
                </InternalLink>
                .
            </p>
            <CopyInput
                value={isLoading ? BACKEND_URL : form?.webhook || ""}
                isLoading={isLoading}
                message="Paste the webhook into your Framer Form webhook settings"
            />
            <Button
                disabled={isLoading}
                onClick={() =>
                    window.open(
                        `${auth.tokens.getOrThrow().instanceUrl}/lightning/setup/ObjectManager/${objectName}/Details/view`,
                        "_blank"
                    )
                }
            >
                View Object
            </Button>
        </main>
    )
}
