import { framer } from "framer-plugin"
import { useDeleteProjectMutation, useProjectQuery } from "@/api"
import { Button } from "../components/Button"
import { CenteredSpinner } from "../components/CenteredSpinner"

export function ProjectPage() {
    const { data: project, isLoading } = useProjectQuery()
    const deleteProjectMutation = useDeleteProjectMutation({
        onSuccess: () => {
            framer.closePlugin("Semrush project deleted.")
        },
    })

    if (isLoading) return <CenteredSpinner />

    if (!project) {
        return <div className="flex-1 flex items-center justify-center text-tertiary">No project found.</div>
    }

    return (
        <div className="col-lg w-[340px]">
            <div className="flex h-[30px] justify-between">
                <p className="w-20 text-tertiary">Name</p>
                <p className="text-primary truncate">{project.project_name}</p>
            </div>
            <div className="flex h-[30px] justify-between">
                <p className="w-20 text-tertiary">URL</p>
                <p className="text-primary truncate">{project.url}</p>
            </div>
            <div className="flex h-[30px] justify-between">
                <p className="w-20 text-tertiary">ID</p>
                <p className="text-primary">{project.project_id}</p>
            </div>
            <div className="flex justify-between items-center">
                <div className="col">
                    <p>Danger Zone</p>
                    <p className="text-tertiary">Delete project and campaigns.</p>
                </div>
                <Button
                    variant="destructive"
                    className="w-[74px]"
                    onClick={() => deleteProjectMutation.mutate()}
                    isPending={deleteProjectMutation.isPending}
                >
                    Delete
                </Button>
            </div>
        </div>
    )
}
