import { ProjectsGroups, Translations } from "@crowdin/crowdin-api-client"
import { framer } from "framer-plugin"

export interface Project {
    readonly id: number
    readonly name: string
}

export interface CrowdinStorageResponse {
    data: {
        id: number
    }
}

export function createCrowdinClient(token: string) {
    return {
        projects: new ProjectsGroups({ token }),
        translations: new Translations({ token }),
    }
}

// Returns a list of projects or null if the access token is invalid
export async function validateAccessTokenAndGetProjects(
    token: string
): Promise<{ isValid: boolean; projects: Project[] | null }> {
    // Persist token
    if (framer.isAllowedTo("setPluginData")) {
        void framer.setPluginData("accessToken", token)
    }

    if (token) {
        try {
            const projectsGroupsApi = new ProjectsGroups({ token })
            const response = await projectsGroupsApi.withFetchAll().listProjects()

            // Only log in development
            if (window.location.hostname === "localhost") {
                console.log(response.data)
            }
            const projects = response.data.map(({ data }: { data: Project }) => ({
                id: data.id,
                name: data.name,
            }))
            return { isValid: true, projects }
        } catch (error) {
            console.error(error)
            return { isValid: false, projects: null }
        }
    } else {
        return { isValid: false, projects: null }
    }
}
