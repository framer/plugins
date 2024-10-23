import { useState } from "react"
import { Redirect, useLocation } from "wouter"
import { useValidateApiKeyMutation } from "@/api"
import { Button } from "@/components/Button"
import SemrushIcon from "@/assets/icon.svg"
import { semrush } from "../api"
import { framer } from "framer-plugin"

export function SetupPage() {
    const [, navigate] = useLocation()
    const [apiKey, setApiKey] = useState("")
    const authMutation = useValidateApiKeyMutation({
        onSuccess: () => {
            navigate("/menu")
        },
        onError: () => framer.notify("Invalid API key", { variant: "error" }),
    })

    if (semrush.auth.isAuthenticated()) {
        return <Redirect to="/menu" />
    }

    const handleApiKeyValidation = () => {
        if (apiKey === "") return
        authMutation.mutate(apiKey)
    }

    return (
        <div className="col-lg">
            <section className="col-lg items-center">
                <img src={SemrushIcon} width={30} height={30} />
                <div className="col items-center">
                    <h6>Connect to Semrush</h6>
                    <p className="text-tertiary max-w-[190px] text-center">
                        Please enter your{" "}
                        <a href="https://www.semrush.com/accounts/subscription-info/api-units/" target="_blank">
                            API key
                        </a>{" "}
                        to continue.
                    </p>
                </div>
            </section>
            <section className="col pt-15 grow">
                <input
                    type="text"
                    placeholder="API Key"
                    className="w-full"
                    onChange={e => setApiKey(e.target.value)}
                    disabled={authMutation.isPending}
                    onKeyDown={e => {
                        if (e.key === "Enter") {
                            handleApiKeyValidation()
                        }
                    }}
                />
                <Button onClick={() => handleApiKeyValidation()} isPending={authMutation.isPending}>
                    Connect
                </Button>
            </section>
        </div>
    )
}
