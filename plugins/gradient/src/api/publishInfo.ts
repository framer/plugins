import type { NodeId } from "./nodes"

export interface PublishPage {
    id: NodeId
    path: string
    url: string | undefined
    stagingUrl: string | undefined
}

export interface PublishInfo {
    /** Whether the current site has been published. */
    hasBeenPublished: boolean
    /** Whether the current site is currently being published. This includes SSG. */
    isPublishing: boolean
    /** All published pages. */
    pages: PublishPage[]
}
