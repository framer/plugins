export type EventMap = Record<string, unknown>
export class TypedEventEmitter<TypedEventMap extends EventMap> {
    private target = new EventTarget()

    on<EventName extends Extract<keyof TypedEventMap, string>>(
        type: EventName,
        listener: TypedEventMap[EventName] extends never ? () => void : (payload: TypedEventMap[EventName]) => void,
        options?: AddEventListenerOptions | boolean
    ): () => void {
        const handler: EventListener = event => {
            const { detail } = event as CustomEvent<TypedEventMap[EventName]>
            listener(detail)
        }

        this.target.addEventListener(type, handler, options)
        return () => {
            this.target.removeEventListener(type, handler, options)
        }
    }

    emit<EventName extends Extract<keyof TypedEventMap, string>>(
        type: EventName,
        ...args: TypedEventMap[EventName] extends never ? [] : [payload: TypedEventMap[EventName]]
    ): void {
        const detail = args[0]
        this.target.dispatchEvent(new CustomEvent(type, { detail }))
    }
}
