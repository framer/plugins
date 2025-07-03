import { type CodeFile, framer, isCodeFileComponentExport, isComponentInstanceNode } from "framer-plugin"
import { useCallback, useEffect, useState } from "react"

export enum StatusTypes {
    INITIAL = "initial",
    SELECTED_CODE_FILE = "selectedCodeFile",
    NO_SELECTION = "noSelection",
    ERROR = "error",
}

type InitialState = {
    type: StatusTypes.INITIAL
}

type CodeFileState = {
    type: StatusTypes.SELECTED_CODE_FILE
    codeFile: CodeFile
}

type NoSelectionState = {
    type: StatusTypes.NO_SELECTION
}

type ErrorState = {
    type: StatusTypes.ERROR
    error: string
}

type State = InitialState | CodeFileState | NoSelectionState | ErrorState

interface UseSelectedCodeFile {
    state: State
    clearSelection: () => void
}

// Hook to handle Framer selection changes
export function useSelectedCodeFile(): UseSelectedCodeFile {
    const [selectedCodeFile, setSelectedCodeFile] = useState<State>({
        type: StatusTypes.INITIAL,
    })

    // Extract code file ID for dependency array
    const codeFileId =
        selectedCodeFile.type === StatusTypes.SELECTED_CODE_FILE ? selectedCodeFile.codeFile.id : undefined

    useEffect(() => {
        // Subscribe to open code file changes in Code Mode
        const unsubscribeOpenCodeFile = framer.subscribeToOpenCodeFile(async codeFile => {
            if (framer.mode !== "code") return

            setSelectedCodeFile(
                codeFile
                    ? {
                          type: StatusTypes.SELECTED_CODE_FILE,
                          codeFile,
                      }
                    : {
                          type: StatusTypes.NO_SELECTION,
                      }
            )
        })

        // Subscribe to selection changes in Canvas Mode
        const unsubscribeSelection = framer.subscribeToSelection(async nodes => {
            if (framer.mode !== "canvas") return

            // If there's no selection or multiple selections, clear the selection
            const firstNode = nodes[0]
            if (nodes.length !== 1) {
                setSelectedCodeFile({
                    type: StatusTypes.NO_SELECTION,
                })
                return
            }

            // Try to get code file for component instances
            if (isComponentInstanceNode(firstNode)) {
                try {
                    const matchingFile = await framer.unstable_getCodeFile(firstNode.componentIdentifier)
                    if (!matchingFile) {
                        setSelectedCodeFile({
                            type: StatusTypes.NO_SELECTION,
                        })
                        return
                    }

                    const componentExports = matchingFile.exports.filter(isCodeFileComponentExport)
                    const componentExport = componentExports[0]
                    if (
                        componentExports.length !== 1 ||
                        (componentExport && componentExport.name !== firstNode.componentName)
                    ) {
                        setSelectedCodeFile({
                            type: StatusTypes.NO_SELECTION,
                        })
                        return
                    }

                    setSelectedCodeFile({
                        type: StatusTypes.SELECTED_CODE_FILE,
                        codeFile: matchingFile,
                    })
                    return
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : "Failed to get code file"
                    setSelectedCodeFile({
                        type: StatusTypes.ERROR,
                        error: errorMessage,
                    })
                    return
                }
            }

            // For other node types, we could potentially get code files in the future
            // For now, we'll set no selection for non-component nodes
            setSelectedCodeFile({
                type: StatusTypes.NO_SELECTION,
            })
        })

        // Subscribe for changes in the code file itself, e.g. on save
        const unsubscribeCodeFile = framer.unstable_subscribeToCodeFiles(async codeFiles => {
            if (selectedCodeFile.type !== StatusTypes.SELECTED_CODE_FILE) return

            const matchingFile = codeFiles.find(codeFile => codeFile.id === codeFileId)

            if (!matchingFile) {
                // Code file has been deleted
                setSelectedCodeFile({
                    type: StatusTypes.NO_SELECTION,
                })
                return
            }

            setSelectedCodeFile({
                type: StatusTypes.SELECTED_CODE_FILE,
                codeFile: matchingFile,
            })
        })

        return () => {
            unsubscribeOpenCodeFile()
            unsubscribeSelection()
            unsubscribeCodeFile()
        }
    }, [selectedCodeFile.type, codeFileId])

    const clearSelection = useCallback(() => {
        try {
            framer.setSelection([])
            setSelectedCodeFile({
                type: StatusTypes.NO_SELECTION,
            })
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to clear selection"
            setSelectedCodeFile({
                type: StatusTypes.ERROR,
                error: errorMessage,
            })
        }
    }, [])

    return {
        state: selectedCodeFile,
        clearSelection,
    }
}
