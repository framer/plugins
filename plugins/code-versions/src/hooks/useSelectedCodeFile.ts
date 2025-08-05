import { type CodeFile, framer, isComponentInstanceNode } from "framer-plugin"
import { useEffect, useState } from "react"

export enum StatusTypes {
    SELECTED_CODE_FILE = "selectedCodeFile",
    NO_SELECTION = "noSelection",
    ERROR = "error",
}

interface NoSelectionState {
    type: StatusTypes.NO_SELECTION
}

interface CodeFileState {
    type: StatusTypes.SELECTED_CODE_FILE
    codeFile: CodeFile
}

interface ErrorState {
    type: StatusTypes.ERROR
    error: string
}

type State = NoSelectionState | CodeFileState | ErrorState

interface UseSelectedCodeFile {
    state: State
}

// Hook to handle Framer selection changes
export function useSelectedCodeFile(): UseSelectedCodeFile {
    const [selectionState, setSelectionState] = useState<State>({
        type: StatusTypes.NO_SELECTION,
    })

    // Extract code file ID for dependency array
    const codeFileId = selectionState.type === StatusTypes.SELECTED_CODE_FILE ? selectionState.codeFile.id : undefined

    useEffect(() => {
        // Subscribe to open code file changes in Code Mode
        // @ts-expect-error TS(2339): Property 'unstable_getCodeFile' does not exist on type 'F...
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const unsubscribeOpenCodeFile = framer.subscribeToOpenCodeFile(codeFile => {
            if (framer.mode !== "code") return

            setSelectionState(
                codeFile
                    ? {
                          type: StatusTypes.SELECTED_CODE_FILE,
                          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                          codeFile,
                      }
                    : {
                          type: StatusTypes.NO_SELECTION,
                      }
            )
        })

        // Subscribe to selection changes in Canvas Mode
        const unsubscribeSelection = framer.subscribeToSelection(nodes => {
            if (framer.mode !== "canvas") return

            // If there's no selection or multiple selections, clear the selection
            if (nodes.length !== 1) {
                setSelectionState({
                    type: StatusTypes.NO_SELECTION,
                })
                return
            }

            // Try to get code file for component instances
            const firstNode = nodes[0]
            const task = async () => {
                if (isComponentInstanceNode(firstNode)) {
                    try {
                        // @ts-expect-error TS(2339): Property 'unstable_getCodeFile' does not exist on type 'F...
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
                        const matchingFile = await framer.unstable_getCodeFile(firstNode.componentIdentifier)
                        if (!matchingFile) {
                            setSelectionState({
                                type: StatusTypes.NO_SELECTION,
                            })
                            return
                        }

                        setSelectionState({
                            type: StatusTypes.SELECTED_CODE_FILE,
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                            codeFile: matchingFile,
                        })
                        return
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : "Failed to get code file"
                        setSelectionState({
                            type: StatusTypes.ERROR,
                            error: errorMessage,
                        })
                        return
                    }
                }

                // For other node types, we could potentially get code files in the future
                // For now, we'll set no selection for non-component nodes
                setSelectionState({
                    type: StatusTypes.NO_SELECTION,
                })
            }

            void task()
        })

        // Subscribe for changes in the code file itself, e.g. on save

        // @ts-expect-error TS(2551): Property 'unstable_subscribeToCodeFiles' does not exist o...
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const unsubscribeCodeFile = framer.unstable_subscribeToCodeFiles(codeFiles => {
            if (selectionState.type !== StatusTypes.SELECTED_CODE_FILE) return

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            const matchingFile = codeFiles.find((codeFile: { id: string | undefined }) => codeFile.id === codeFileId)

            if (!matchingFile) {
                // Code file has been deleted
                setSelectionState({
                    type: StatusTypes.NO_SELECTION,
                })
                return
            }

            setSelectionState({
                type: StatusTypes.SELECTED_CODE_FILE,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                codeFile: matchingFile,
            })
        })

        return () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            unsubscribeOpenCodeFile()
            unsubscribeSelection()
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            unsubscribeCodeFile()
        }
    }, [selectionState.type, codeFileId])

    return {
        state: selectionState,
    }
}
