type OptimizationStatus = "optimizing" | "optimized" | "error"

interface Publish {
    deploymentTime: number
    optimizationStatus: OptimizationStatus
    url: string
    currentPageUrl: string
}

export interface PublishInfo {
    production: Publish | null
    staging: Publish | null
}
