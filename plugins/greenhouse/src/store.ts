import { framer } from "framer-plugin"
import { create } from "zustand"

async function getKey(key: string) {
    const collection = await framer.getActiveManagedCollection()
    const value = await collection.getPluginData(key)

    return value || ""
}

async function setKey(key: string, value: string) {
    const collection = await framer.getActiveManagedCollection()

    return collection.setPluginData(key, value)
}

// Global state management using Zustand
interface Store {
    contentTypeId: string
    setContentTypeId: (contentTypeId: string) => void
    boardToken: string
    setBoardToken: (boardToken: string) => void
    slugFieldId: string
    setSlugFieldId: (slugFieldId: string) => void
    getInitialData: () => Promise<void>
}

// Create store with persistence to Framer plugin data
export const useStore = create<Store>(set => ({
    contentTypeId: "",
    setContentTypeId: (contentTypeId: string) => {
        setKey("contentTypeId", contentTypeId)
        set({ contentTypeId })
    },
    boardToken: "",
    setBoardToken: (boardToken: string) => {
        setKey("boardToken", boardToken)
        set({ boardToken })
    },
    slugFieldId: "",
    setSlugFieldId: (slugFieldId: string) => {
        setKey("slugFieldId", slugFieldId)
        set({ slugFieldId })
    },
    getInitialData: async () => {
        const contentTypeId = await getKey("contentTypeId")
        const boardToken = await getKey("boardToken")
        const slugFieldId = await getKey("slugFieldId")

        set({ contentTypeId, boardToken, slugFieldId })
    },
}))

useStore.getState().getInitialData()
