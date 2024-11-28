import { framer } from "framer-plugin"
import { useState } from "react"
import { useLocation } from "wouter"
import { request } from "@/api"
import { Button } from "@/components/Button"
import { ExternalLink } from "@/components/Link"
import { BUSINESS_UNIT_ID_KEY } from "@/constants"

export default function BusinessUnitId() {
    const [, navigate] = useLocation()
    const [isLoading, setIsLoading] = useState(false)
    const [unitId, setUnitId] = useState("")

    const handleSkip = () => {
        // Empty string so we know we have at least been through
        // this stage
        localStorage.setItem(BUSINESS_UNIT_ID_KEY, "")
        navigate("/menu")
    }

    const handleAddBusinessUnit = async () => {
        setIsLoading(true)

        try {
            // Small request to validate the business unit
            await request({
                service: "mcae",
                path: "/objects/forms",
                query: {
                    fields: "id",
                    limit: 1,
                },
            })

            navigate("/menu")
        } catch {
            framer.notify("Invalid Business Unit Id", { variant: "error" })
            // Failed to validate it, set it back to empty string
            setUnitId("")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <main>
            <div className="h-full col items-center justify-center">
                <h6>Account Engagement</h6>
                <p className="max-w-[200px] text-center text-tertiary">
                    Enter your Business Unit ID. Need help? Learn more{" "}
                    <ExternalLink href="https://help.salesforce.com/s/articleView?id=000381973&type=1">
                        here
                    </ExternalLink>
                    .
                </p>
            </div>
            <div className="col-lg">
                <input
                    type="text"
                    placeholder="Business Unit ID"
                    value={unitId}
                    onChange={e => setUnitId(e.target.value)}
                    className="w-full"
                />
                <div className="row">
                    <button onClick={handleSkip} className="flex-1">
                        Skip
                    </button>
                    <Button
                        onClick={handleAddBusinessUnit}
                        className="flex-1 framer-button-primary"
                        isLoading={isLoading}
                    >
                        Connect
                    </Button>
                </div>
            </div>
        </main>
    )
}
