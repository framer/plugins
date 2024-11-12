import { useParams, useSearch } from "wouter"
import { Indicator } from "@/components/Indicator"
import { TableContainer, TableHead, TableCell, TableBody, TableRow } from "@/components/Table"
import { AUDIT_ISSUES } from "@/constants"
import { useIssueReportQuery } from "@/api"
import { CenteredSpinner } from "@/components/CenteredSpinner"

export function AuditReportIssuesPage() {
    const searchString = useSearch()
    const params = useParams()

    const snapshotId = new URLSearchParams(searchString).get("snapshotId")
    const issueId = params.issueId

    if (!snapshotId || !issueId) {
        throw new Error("Missing snapshotId or issueId")
    }

    const issue = AUDIT_ISSUES[Number(issueId)]
    const { data: issueReport, isLoading } = useIssueReportQuery(snapshotId, Number(issueId))

    if (isLoading) return <CenteredSpinner />

    if (!issueReport) {
        return (
            <div className="flex-1 flex items-center justify-center text-tertiary">
                {`No issue report for issueId '${issueId}' with snapshot id '${snapshotId}'`}
            </div>
        )
    }

    return (
        <div className="col-lg w-[650px]">
            <div className="flex gap-[5px] items-center">
                <Indicator type={issue.type} />
                <h6>{issue.title}</h6>
            </div>
            <div className="col">
                <p className="text-primary">About the issue</p>
                <p dangerouslySetInnerHTML={{ __html: issue.description }} />
            </div>
            <div className="col">
                <p className="text-primary">How to fix it</p>
                <p dangerouslySetInnerHTML={{ __html: issue.solution }} />
            </div>
            <TableContainer>
                <TableHead>
                    <TableCell className="grow">Page</TableCell>
                </TableHead>
                <TableBody>
                    {issueReport.data.map((issue, i) => (
                        <TableRow key={i}>
                            <TableCell className="grow">
                                <a>{issue.source_url}</a>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </TableContainer>
        </div>
    )
}
