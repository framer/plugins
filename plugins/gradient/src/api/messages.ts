import type { PluginMessageAPI } from "./api"

import { CanvasNodeData, CanvasRootData } from "./nodes"
import { PublishInfo } from "./publishInfo"
import { isObject, isString } from "./utils"

export type PluginMessageId = number

export interface PluginMethodResponse {
    type: "methodResponse"
    id: PluginMessageId
    result: unknown
    error: string | null
}

export interface PluginMethodInvocation {
    type: "methodInvocation"
    methodName: keyof PluginMessageAPI
    id: PluginMessageId
    args: unknown[]
}

export interface PluginSubscription {
    type: "subscribe" | "unsubscribe"
    id: number
    topic: PluginSubscriptionTopic
}

export interface PluginEvent {
    type: "event"
    payload: PluginEventPayload
}

type PluginEventPayload = PluginInitEvent

interface PluginInitEvent {
    type: "init"
}

interface PluginSubscriptionMessage<Topic extends string, Payload> {
    type: "subscriptionMessage"
    topic: Topic
    payload: Payload
}

export type PluginSubscriptionEvent =
    | PluginSubscriptionMessage<"publishInfo", PublishInfo>
    | PluginSubscriptionMessage<"selection", CanvasNodeData[]>
    | PluginSubscriptionMessage<"canvasRoot", CanvasRootData>

export type PluginSubscriptionTopic = PluginSubscriptionEvent["topic"]

export type PluginMessage =
    | PluginMethodResponse
    | PluginMethodInvocation
    | PluginEvent
    | PluginSubscription
    | PluginSubscriptionEvent

const allTypes: Record<PluginMessage["type"], true> = {
    event: true,
    methodInvocation: true,
    methodResponse: true,
    subscribe: true,
    unsubscribe: true,
    subscriptionMessage: true,
}

function isPluginMessageType(type: unknown): type is PluginMessage["type"] {
    return isString(type) && type in allTypes
}

export function isPluginMessage(data: unknown): data is PluginMessage {
    const typeKey: keyof PluginMessage = "type"
    return isObject(data) && isPluginMessageType(data[typeKey])
}
