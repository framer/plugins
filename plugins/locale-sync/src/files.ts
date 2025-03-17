export function downloadBlob(value: string, filename: string, type: string) {
    const blob = new Blob([value], { type })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = filename

    a.click()
    URL.revokeObjectURL(url)
}

export function importFileAsText(accept: string, handleImport: (file: string) => Promise<void>) {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = accept

    input.onchange = async event => {
        const file = (event.target as HTMLInputElement).files?.[0]
        if (!file) return
        const fileText = await file.text()

        void handleImport(fileText)
    }

    input.click()
}
