const HDR_PREFIX = "hdr:"

export const isHeader = (id: string | undefined) => id?.startsWith(HDR_PREFIX)
export const headerId = (id: string) => `${HDR_PREFIX}${id}`

export enum NavigationDirection {
    Down = 1,
    Up = -1,
}
