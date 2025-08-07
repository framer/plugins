import type { IndexEntry } from "./types"

export interface Events {
    upsert: { entry: IndexEntry }
    error: { error: Error }
    progress: { processed: number; total?: number }
    started: void
    completed: void
    restarted: void
    aborted: void
}

export class TypedEventEmitter {
    private target = new EventTarget()

    on<EventName extends keyof Events>(type: EventName, listener: (event: Events[EventName]) => void): () => void {
        const eventListener = (e: Event) => {
            const customEvent = e as CustomEvent<Events[EventName]>
            listener(customEvent.detail)
        }

        this.target.addEventListener(type, eventListener)

        return () => {
            this.target.removeEventListener(type, eventListener)
        }
    }

    emit<EventName extends keyof Events>(type: EventName, detail: Events[EventName]) {
        this.target.dispatchEvent(new CustomEvent(type, { detail }))
    }
}
