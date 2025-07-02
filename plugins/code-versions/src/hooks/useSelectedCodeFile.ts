import { type CodeFile, framer, isCodeFileComponentExport, isComponentInstanceNode } from "framer-plugin"
import { useCallback, useEffect, useState } from "react"

export enum StatusTypes {
    INITIAL = "initial",
    SELECTED_CODE_FILE = "selectedCodeFile",
    NO_SELECTION = "noSelection",
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

type State = InitialState | CodeFileState | NoSelectionState

// Hook to handle Framer selection changes
export function useSelectedCodeFile() {
    const [selectedCodeFile, setSelectedCodeFile] = useState<State>({
        type: StatusTypes.INITIAL,
    })

    useEffect(() => {
        // Subscribe to open code file changes in Code Mode
        const unsubscribeOpenCodeFile = framer.subscribeToOpenCodeFile(async codeFile => {
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

            const matchingFile = codeFiles.find(codeFile => codeFile.id === selectedCodeFile.codeFile.id)

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
    }, [])

    const clearSelection = useCallback(() => {
        framer.setSelection([])
        setSelectedCodeFile({
            type: StatusTypes.NO_SELECTION,
        })
    }, [])

    return {
        state: selectedCodeFile,
        clearSelection,
    }
}
