import { useRunAuditMutation, useAuditQuery } from "@/api"
import { TableContainer, TableHead, TableRow, TableBody, TableCell } from "@/components/Table"
import { Button } from "@/components/Button"
import { Indicator } from "@/components/Indicator"
import { Link } from "wouter"
import { CenteredSpinner } from "@/components/CenteredSpinner"

export function AuditReportPage() {
    const { data: audit, isLoading: isLoadingAudit } = useAuditQuery({
        formatSnapshotData: true,
    })
    const runAuditMutation = useRunAuditMutation()

    if (isLoadingAudit) return <CenteredSpinner />

    if (!audit) {
        return <div className="flex-1 flex items-center justify-center text-tertiary">No audit found.</div>
    }

    if (audit?.status !== "FINISHED") {
        return <p>Loading audit...</p>
    }

    if (audit.current_snapshot === null) {
        return (
            <div className="col-lg">
                <p>No snapshots found. You must run at least one audit.</p>
                <hr />
                <Button
                    onClick={() => runAuditMutation.mutate()}
                    isLoading={runAuditMutation.isPending}
                    className="w-full"
                >
                    Run
                </Button>
            </div>
        )
    }

    const {
        current_snapshot: { quality, snapshotId },
        timeAgo,
        annotatedIssues: { errors, warnings, notices },
        id,
    } = audit
    const issues = [...errors, ...warnings, ...notices]

    return (
        <section className="col-lg px-15 w-[650px]">
            <div className="flex justify-between pb-15">
                <div className="col">
                    <p>Last updated: {timeAgo}</p>
                    <a target="_blank" href={`https://semrush.com/siteaudit/campaign/${id}/review/#overview`}>
                        View in Semrush
                    </a>
                </div>
                <Button
                    className="w-[74px]"
                    onClick={() => runAuditMutation.mutate()}
                    isLoading={runAuditMutation.isPending}
                >
                    Rerun
                </Button>
            </div>
            <hr />
            <div className="flex gap-8">
                <div className="flex flex-col gap-8">
                    <p>Score</p>
                    <h1 className="text-2xl font-bold">{quality.value}%</h1>
                </div>
                <div className="flex flex-col gap-8">
                    <p>Errors</p>
                    <h1 className="text-2xl font-bold text-framer-red">{errors.length}</h1>
                </div>
                <div className="flex flex-col gap-8">
                    <p>Warnings</p>
                    <h1 className="text-2xl font-bold text-framer-yellow">{warnings.length}</h1>
                </div>
                <div className="flex flex-col gap-8">
                    <p>Notices</p>
                    <h1 className="text-2xl font-bold text-framer-blue">{notices.length}</h1>
                </div>
            </div>
            {issues.length > 0 && (
                <TableContainer>
                    <TableHead className={issues.length > 15 ? "pr-4" : ""}>
                        <TableCell className="grow">Issue</TableCell>
                        <TableCell>Count</TableCell>
                        <TableCell>Checks</TableCell>
                    </TableHead>
                    <TableBody>
                        {issues.map((issue, i) => (
                            <TableRow key={i}>
                                <TableCell className="grow flex items-center gap-[5px]">
                                    <Indicator type={issue.type} />
                                    <Link
                                        className="line-clamp-2"
                                        href={`/issues/${issue.id}&snapshotId=${snapshotId}`}
                                    >
                                        {issue.description}
                                    </Link>
                                </TableCell>
                                <TableCell>{issue.checks}</TableCell>
                                <TableCell>{issue.count}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </TableContainer>
            )}
        </section>
    )
}
