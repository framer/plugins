import { PluginImage, PluginImageData } from "./image"
import type { AnyNode, AnyNodeData } from "./nodes"

export interface WithName {
    readonly name: string | null
}

export interface WithBackgroundColor {
    readonly backgroundColor: string | null
}

export interface WithBackgroundImageData {
    readonly backgroundImageData: PluginImageData | null
}

export interface WithBackgroundImage {
    readonly backgroundImage: PluginImage | null
}

export interface WithRotation {
    readonly rotation: number | null
}

export interface WithOpacity {
    readonly opacity: number | null
}

export type BorderRadius = `${number}%` | `${number}px` | `${number}px ${number}px ${number}px ${number}px` | null

export interface WithBorderRadius {
    readonly borderRadius: BorderRadius
}

// Utils

type PartialNodeData = AnyNode | Partial<AnyNodeData>

const nameKey: keyof WithName = "name"
export function withName<T extends PartialNodeData>(node: T): node is T & WithName {
    return nameKey in node
}

const backgroundColorKey: keyof WithBackgroundColor = "backgroundColor"
export function withBackgroundColor<T extends PartialNodeData>(node: T): node is T & WithBackgroundColor {
    return backgroundColorKey in node
}

const backgroundImageKey: keyof WithBackgroundImage = "backgroundImage"
export function withBackgroundImage<T extends PartialNodeData>(node: T): node is T & WithBackgroundImage {
    return backgroundImageKey in node
}

const rotationKey: keyof WithRotation = "rotation"
export function withRotation<T extends PartialNodeData>(node: T): node is T & WithRotation {
    return rotationKey in node
}

const opacityKey: keyof WithOpacity = "opacity"
export function withOpacity<T extends PartialNodeData>(node: T): node is T & WithOpacity {
    return opacityKey in node
}

const borderRadiusKey: keyof WithBorderRadius = "borderRadius"
export function withBorderRadius<T extends PartialNodeData>(node: T): node is T & WithBorderRadius {
    return borderRadiusKey in node
}
