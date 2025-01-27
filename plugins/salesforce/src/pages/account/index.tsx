import { framer } from "framer-plugin"
import auth from "@/auth"
import {
    SFCorsWhitelist,
    SFTrustedSitesList,
    useCorsWhitelistMutation,
    useCorsWhitelistQuery,
    useLogoutMutation,
    useOrgQuery,
    useRemoveCorsWhitelistMutation,
    useRemoveTrustedSiteMutation,
    useTrustedSiteMutation,
    useTrustedSitesQuery,
    useUserQuery,
} from "@/api"
import { CenteredSpinner } from "@/components/CenteredSpinner"
import { Button } from "@/components/Button"
import { usePublishInfo } from "@/hooks/usePublishInfo"
import { useState } from "react"
import { InfoIcon } from "@/components/Icons"
import { InternalLink } from "@/components/Link"

interface DomainButtonProps {
    domain: string
    trustedSites: string[]
    corsWhitelist: string[]
    trustedSitesData?: SFTrustedSitesList
    corsWhitelistData?: SFCorsWhitelist
    disabled?: boolean
    isLoading?: boolean
}

const DomainButton = ({
    domain,
    trustedSites,
    corsWhitelist,
    trustedSitesData,
    corsWhitelistData,
    disabled,
    isLoading,
}: DomainButtonProps) => {
    const [isLoadingLocal, setIsLoadingLocal] = useState(false)

    const { mutateAsync: addTrustedSite } = useTrustedSiteMutation()
    const { mutateAsync: addCorsWhitelist } = useCorsWhitelistMutation()
    const { mutateAsync: removeTrustedSite } = useRemoveTrustedSiteMutation()
    const { mutateAsync: removeCorsWhitelist } = useRemoveCorsWhitelistMutation()

    // If we don't have the required data yet, show disabled
    if (!trustedSitesData || !corsWhitelistData) {
        return <Button variant="secondary" className="w-[86px]" isLoading disabled />
    }

    const isConnectedToTrustedSites = trustedSites.includes(domain)
    const isConnectedToCors = corsWhitelist.includes(domain)
    const isFullyConnected = isConnectedToTrustedSites && isConnectedToCors

    const handleConnect = async () => {
        if (!trustedSitesData || !corsWhitelistData) return

        try {
            setIsLoadingLocal(true)
            if (!trustedSites.includes(domain)) {
                await addTrustedSite({
                    url: domain,
                    description: `Framer domain: ${domain}`,
                })
            }

            if (!corsWhitelist.includes(domain)) {
                await addCorsWhitelist(domain)
            }
        } finally {
            setIsLoadingLocal(false)
        }
    }

    const handleDisconnect = async () => {
        if (!trustedSitesData || !corsWhitelistData) return

        try {
            setIsLoadingLocal(true)

            const trustedSite = trustedSitesData.records.find(site => site.EndpointUrl === domain)
            const corsEntry = corsWhitelistData.records.find(entry => entry.UrlPattern === domain)

            if (trustedSite?.Id) {
                await removeTrustedSite(trustedSite.Id)
            }

            if (corsEntry?.Id) {
                await removeCorsWhitelist(corsEntry.Id)
            }
        } finally {
            setIsLoadingLocal(false)
        }
    }

    return (
        <Button
            variant={isFullyConnected ? "secondary" : "primary"}
            className="w-[86px]"
            isLoading={isLoading || isLoadingLocal}
            disabled={disabled}
            onClick={() => (isFullyConnected ? handleDisconnect() : handleConnect())}
        >
            {isFullyConnected ? "Disconnect" : "Connect"}
        </Button>
    )
}

export default function Account() {
    const publishInfo = usePublishInfo()
    const stagingUrl = publishInfo?.staging?.url
    const prodUrl = publishInfo?.production?.url

    const { data: trustedSites, isLoading: isLoadingTrustedSites } = useTrustedSitesQuery()
    const { data: corsWhitelist, isLoading: isLoadingCorsWhitelist } = useCorsWhitelistQuery()
    const { data: user, isLoading: isLoadingUser } = useUserQuery()
    const { data: org, isLoading: isLoadingOrg } = useOrgQuery(user?.organization_id || "")
    const { mutate: logout, isPending: isLoggingOut } = useLogoutMutation({
        onSuccess: () => framer.closePlugin("To completely remove Framer, uninstall the app from Salesforce"),
        onError: e => framer.notify(e instanceof Error ? e.message : JSON.stringify(e)),
    })

    const trustedSiteUrls = trustedSites?.records.map(site => site.EndpointUrl) || []
    const corsWhitelistUrls = corsWhitelist?.records.map(entry => entry.UrlPattern) || []

    if (isLoadingUser || isLoadingOrg) return <CenteredSpinner />

    if (!user || !org) return null

    return (
        <main>
            <h6>User</h6>
            <div className="panel-row">
                <span>Email</span>
                <p>{user.email}</p>
            </div>
            <h6>Org</h6>
            <div className="col">
                <div className="panel-row">
                    <span>Name</span>
                    <p>{org.Name}</p>
                </div>
                <div className="panel-row">
                    <span>Type</span>
                    <p>{org.OrganizationType}</p>
                </div>
                <div className="panel-row">
                    <span>BUID</span>
                    <p>{auth.getBusinessUnitId() || "N/A"}</p>
                </div>
            </div>
            <InternalLink href="/account/domain-connection" className="flex gap-[5px] items-center">
                <h6>Domain</h6>
                <InfoIcon />
            </InternalLink>
            <div className="col">
                <div className="panel-row">
                    <span>Staging</span>
                    {stagingUrl ? (
                        <DomainButton
                            domain={stagingUrl}
                            trustedSites={trustedSiteUrls}
                            corsWhitelist={corsWhitelistUrls}
                            trustedSitesData={trustedSites}
                            corsWhitelistData={corsWhitelist}
                            isLoading={isLoadingTrustedSites || isLoadingCorsWhitelist}
                        />
                    ) : (
                        <Button variant="secondary" className="w-[86px]" disabled>
                            N/A
                        </Button>
                    )}
                </div>
                <div className="panel-row">
                    <span>Production</span>
                    {stagingUrl ? (
                        <DomainButton
                            domain={prodUrl || stagingUrl}
                            trustedSites={trustedSiteUrls}
                            corsWhitelist={corsWhitelistUrls}
                            trustedSitesData={trustedSites}
                            corsWhitelistData={corsWhitelist}
                            isLoading={isLoadingTrustedSites || isLoadingCorsWhitelist}
                        />
                    ) : (
                        <Button variant="secondary" className="w-[86px]" disabled>
                            N/A
                        </Button>
                    )}
                </div>
            </div>
            <hr />
            <Button variant="destructive" onClick={() => logout()} isLoading={isLoggingOut}>
                Logout
            </Button>
        </main>
    )
}
