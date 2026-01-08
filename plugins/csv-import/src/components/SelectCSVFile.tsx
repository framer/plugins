import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react"

interface SelectCSVFileProps {
    onFileSelected: (csvContent: string) => Promise<void>
}

export function SelectCSVFile({ onFileSelected }: SelectCSVFileProps) {
    const form = useRef<HTMLFormElement>(null)
    const inputOpenedFromImportButton = useRef(false)
    const [isDragging, setIsDragging] = useState(false)

    useEffect(() => {
        const formElement = form.current
        if (!formElement) return

        const handleDragOver = (event: DragEvent) => {
            event.preventDefault()
            setIsDragging(true)
        }

        const handleDragLeave = (event: DragEvent) => {
            if (!formElement.contains(event.relatedTarget as Node)) {
                setIsDragging(false)
            }
        }

        const handleDrop = (event: DragEvent) => {
            event.preventDefault()
            setIsDragging(false)

            const file = event.dataTransfer?.files[0]
            if (!file?.name.endsWith(".csv")) return

            const input = document.getElementById("file-input") as HTMLInputElement
            const dataTransfer = new DataTransfer()
            dataTransfer.items.add(file)
            input.files = dataTransfer.files
            formElement.requestSubmit()
        }

        formElement.addEventListener("dragover", handleDragOver)
        formElement.addEventListener("dragleave", handleDragLeave)
        formElement.addEventListener("drop", handleDrop)

        return () => {
            formElement.removeEventListener("dragover", handleDragOver)
            formElement.removeEventListener("dragleave", handleDragLeave)
            formElement.removeEventListener("drop", handleDrop)
        }
    }, [])

    useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            const target = event.target as HTMLElement
            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return

            const { clipboardData } = event
            if (!clipboardData) return

            const task = async () => {
                let csv = ""

                try {
                    csv = clipboardData.getData("text/plain")
                    if (!csv) return
                } catch (error) {
                    console.error("Error accessing clipboard data:", error)
                    return
                }

                await onFileSelected(csv)
            }

            void task()
        }

        window.addEventListener("paste", handlePaste)

        return () => {
            window.removeEventListener("paste", handlePaste)
        }
    }, [onFileSelected])

    const handleSubmit = useCallback(
        (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault()

            if (!form.current) throw new Error("Form ref not set")

            const formData = new FormData(form.current)
            const fileValue = formData.get("file")

            if (!fileValue || typeof fileValue === "string") return

            const file = fileValue

            void file.text().then(onFileSelected)
        },
        [onFileSelected]
    )

    const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        if (!event.currentTarget.files?.[0]) return
        if (inputOpenedFromImportButton.current) {
            form.current?.requestSubmit()
        }
    }, [])

    return (
        <form ref={form} className="select-csv-file" onSubmit={handleSubmit}>
            <input
                id="file-input"
                type="file"
                name="file"
                className="file-input"
                accept=".csv"
                required
                onChange={handleFileChange}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                    cursor: "pointer",
                }}
            />

            {isDragging && (
                <div className="intro dropzone">
                    <p>Drop CSV file to import</p>
                </div>
            )}

            {!isDragging && (
                <>
                    <div className="intro">
                        <h2>CSV Import</h2>
                        <p>Select a CMS collection and upload or drop your CSV here.</p>

                        <button
                            className="framer-button-primary upload-button"
                            onClick={event => {
                                event.preventDefault()
                                inputOpenedFromImportButton.current = true

                                const input = document.getElementById("file-input") as HTMLInputElement
                                input.click()
                            }}
                        >
                            Upload File
                        </button>
                    </div>
                </>
            )}
        </form>
    )
}
