import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import SemrushClient, { Issue, Tokens } from "./semrush"
import { useEffect, useState } from "react"
import { AUDIT_ISSUES } from "./constants"
import { framer } from "framer-plugin"
import { formatNumWithMetricPrefix, timeAgo } from "./utils"

const semrushClientInstance = new SemrushClient({
    defaultAuditSettings: {
        // Issues a Framer user cannot resolve e.g. uncached JS
        excludedChecks: [4, 9, 10, 16, 17, 18, 27, 28, 43, 27, 29, 41, 131, 132, 133, 134, 145, 127],
    },
})

const handler: ProxyHandler<SemrushClient> = {
    set(target, prop, value) {
        // Save to local storage on change
        if (prop === "apiKey") {
            window.localStorage.setItem("semrushApiKey", JSON.stringify(value))
        }

        if (prop === "tokens") {
            const tokens: Tokens = value
            const storedTokens = {
                createdAt: Date.now(),
                expiredIn: tokens.expires_in,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
            }

            window.localStorage.setItem("tokens", JSON.stringify(storedTokens))
        }

        return Reflect.set(target, prop, value)
    },
}

export const semrush = new Proxy(semrushClientInstance, handler)

async function getStagingInfo() {
    const publishInfo = await framer.getPublishInfo()
    const stagingInfo = publishInfo.staging

    if (!stagingInfo) {
        throw new Error("This project must be published to staging.")
    }

    return {
        ...stagingInfo,
        hostname: new URL(stagingInfo.url).hostname,
    }
}

// Removes unrelated issues and annotates the rest
// with their type and description
function annotateIssues(issues: Issue[], type: "error" | "warning" | "notice") {
    const applicableAuditIssues = issues.filter(issue => issue.count > 0)
    return applicableAuditIssues.map(issue => ({
        ...issue,
        type,
        description: AUDIT_ISSUES[issue.id].description ?? String(issue.id),
    }))
}

const transformKeywordRow = (cell: Awaited<ReturnType<typeof semrush.getKeyphrases>>[0]) => ({
    keyword: cell.Keyword,
    searchVolume: formatNumWithMetricPrefix(Number(cell["Search Volume"])),
    trends: cell.Trends.split(","),
    cpc: cell.CPC,
    difficulty: cell["Keyword Difficulty Index"],
    totalResults: formatNumWithMetricPrefix(Number(cell["Number of Results"])),
    // Intent is the only possible empty cell
    intentCodes: cell.Intent === "" ? null : cell.Intent.split(","),
})

export function useValidateApiKeyMutation({ onSuccess, onError }: { onSuccess?: () => void; onError?: () => void }) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (apiKey: string) => semrush.setApiKey(apiKey),
        onSuccess: () => {
            queryClient.prefetchQuery({
                queryKey: ["project"],
                queryFn: async () => {
                    const { hostname } = await getStagingInfo()
                    return semrush.getOrCreateProject(hostname)
                },
            })

            onSuccess?.()
        },
        onError,
    })
}

export function useProjectQuery() {
    return useQuery({
        queryKey: ["project"],
        queryFn: async () => {
            const { hostname } = await getStagingInfo()
            return semrush.getOrCreateProject(hostname)
        },
        throwOnError: true,
    })
}

export function useDeleteProjectMutation({ onSuccess }: { onSuccess: () => void }) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: () => semrush.projects.delete(),
        onSuccess: () => {
            queryClient.clear()
            onSuccess()
        },
    })
}

export function useInfiniteKeywordSearchQuery(args: Omit<Parameters<typeof semrush.getKeyphrases>[0], "offset">) {
    const { keyword, database, limit, type, sort } = args

    return useInfiniteQuery({
        queryKey: ["keywords", { keyword, database, type, sort }],
        enabled: !!keyword,
        initialPageParam: 0,
        placeholderData: keepPreviousData,
        queryFn: ({ pageParam }) => {
            const offset = pageParam * limit
            return semrush.getKeyphrases({
                ...args,
                offset,
                limit: offset + limit,
            })
        },
        getNextPageParam: (lastPage, _allPages, lastPageParam) => {
            return lastPage.length === 0 ? undefined : lastPageParam + 1
        },
        getPreviousPageParam: (_firstPage, _allPages, firstPageParam) => {
            return firstPageParam <= 1 ? undefined : firstPageParam - 1
        },
        select: data => {
            return data.pages.flatMap(page => page.map(row => transformKeywordRow(row)))
        },
    })
}

export function useAuditQuery({ formatSnapshotData }: { formatSnapshotData: boolean }) {
    const [refetchInterval, setRefetchInterval] = useState(4500)
    const { data, ...rest } = useQuery({
        throwOnError: true,
        queryKey: ["audit"],
        queryFn: () => semrush.audit.get(),
        select: data => {
            // Don't format if no previous audit data exists or if not requested
            if (data.current_snapshot === null || !formatSnapshotData) {
                return {
                    ...data,
                    timeAgo: undefined,
                    annotatedIssues: {
                        errors: [],
                        warnings: [],
                        notices: [],
                    },
                }
            }

            const { errors, warnings, notices } = data.current_snapshot

            return {
                ...data,
                timeAgo: timeAgo(data.current_snapshot.finish_date),
                annotatedIssues: {
                    errors: annotateIssues(errors, "error"),
                    warnings: annotateIssues(warnings, "warning"),
                    notices: annotateIssues(notices, "notice"),
                },
            }
        },
        refetchInterval,
    })
    const isAuditFinished = data?.status === "FINISHED"

    // Poll for audit status
    useEffect(() => {
        if (isAuditFinished || !data) {
            setRefetchInterval(0)
        } else {
            setRefetchInterval(4500)
        }
    }, [isAuditFinished, data])

    return { data, ...rest }
}

export function useRunAuditMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async () => semrush.audit.run(),
        onSuccess: () => queryClient.refetchQueries({ queryKey: ["audit"] }),
    })
}

export function useEditAuditMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (audit: Parameters<typeof semrush.audit.update>[0]) => {
            return semrush.audit.update(audit)
        },
        onSuccess: () => {
            framer.notify("Audit settings saved.", { variant: "success" })
            return queryClient.refetchQueries({ queryKey: ["audit"] })
        },
    })
}

export const usePrefetchAuditQuery = () => {
    const queryClient = useQueryClient()

    return () => {
        queryClient.prefetchQuery({
            queryKey: ["audit"],
            queryFn: () => semrush.audit.get(),
        })
    }
}

export const useIssueReportQuery = (snapshotId: string, issueId: number) => {
    return useQuery({
        queryKey: ["issue", snapshotId, issueId],
        queryFn: () => semrush.audit.getIssueReport(snapshotId, issueId),
    })
}
