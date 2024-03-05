import type { PostMessageAPI } from "./api"
import { CanvasNodeData, CanvasRootData } from "./nodes"
import { PublishInfo } from "./publishInfo"
import { isObject, isString } from "./utils"

export type RPCMessageId = number

export interface RPCMethodResponse {
    type: "methodResponse"
    id: RPCMessageId
    result: unknown
    // TODO: error?
    error: null
}

export interface RPCMethodInvocation {
    type: "methodInvocation"
    methodName: keyof PostMessageAPI
    id: RPCMessageId
    args: unknown[]
}

export interface RPCSubscription {
    type: "subscribe" | "unsubscribe"
    id: number
    topic: RPCSubscriptionTopic
}

export interface RPCEvent {
    type: "event"
    payload: RPCEventPayload
}

type RPCEventPayload = RPCInitEvent

interface RPCInitEvent {
    type: "init"
}

interface RPCSubscriptionMessage<TTopic extends string, TPayload> {
    type: "subscriptionMessage"
    topic: TTopic
    payload: TPayload
}

export type RPCSubscriptionEvent =
    | RPCSubscriptionMessage<"publishInfo", PublishInfo>
    | RPCSubscriptionMessage<"selection", CanvasNodeData[]>
    | RPCSubscriptionMessage<"canvasRoot", CanvasRootData>

export type RPCSubscriptionTopic = RPCSubscriptionEvent["topic"]

type RPCMessage = RPCMethodResponse | RPCMethodInvocation | RPCEvent | RPCSubscription | RPCSubscriptionEvent

const allTypes: Record<RPCMessage["type"], true> = {
    event: true,
    methodInvocation: true,
    methodResponse: true,
    subscribe: true,
    unsubscribe: true,
    subscriptionMessage: true,
}

function isRPCType(type: unknown): type is RPCMessage["type"] {
    return isString(type) && type in allTypes
}

export function isRPCMessage(data: unknown): data is RPCMessage {
    const typeKey: keyof RPCMessage = "type"
    return isObject(data) && isRPCType(data[typeKey])
}
