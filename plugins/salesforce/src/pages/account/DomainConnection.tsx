import { ExternalLink } from "../../components/Link"

export default function DomainConnection() {
    return (
        <main>
            <p>
                Adds your domains to the <ExternalLink href="https://google.com">Trusted Sites</ExternalLink> and{" "}
                <ExternalLink href="https://google.com">CORS Whitelist</ExternalLink> in your Salesforce Org to ensure
                both forms and bots can communicate with Salesforce.
            </p>
            <button
                className="framer-button-primary"
                onClick={() =>
                    window.open(
                        "https://help.salesforce.com/s/articleView?id=sf.security_overview.htm&type=5",
                        "_blank"
                    )
                }
            >
                Learn More
            </button>
        </main>
    )
}
