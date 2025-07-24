import type { PageProps } from "../../../router"

export default function FormsInstallationPage({ goBack }: PageProps) {
    return (
        <main>
            <span>There are two ways to use HubSpot forms with Framer:</span>
            <ol className="list-decimal list-inside space-y-2.5 *:text-tertiary marker:text-secondary">
                <li className="font-medium text-secondary">Embed the form directly using the previous page.</li>
                <li className="font-medium text-secondary">
                    Create a Framer form with input names matching your contact property internal names, and enable
                    tracking. This only works for single-line text fields.
                </li>
            </ol>
            <div className="row">
                <button className="flex-1" onClick={goBack}>
                    Back
                </button>
                <button
                    className="framer-button-primary flex-1"
                    onClick={() => window.open("https://knowledge.hubspot.com/forms/use-non-hubspot-forms", "_blank")}
                >
                    Learn More
                </button>
            </div>
        </main>
    )
}
