export async function copyToClipboard(text: string): Promise<void> {
  // Try execCommand first (no permissions needed)
  if (execCommandCopy(text)) return
  // Fall back to modern API if execCommand fails
  await navigator.clipboard?.writeText(text)
}
function execCommandCopy(text: string): boolean {
  try {
    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.style.position = "fixed"
    textarea.style.opacity = "0"
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand("copy")
    document.body.removeChild(textarea)
    return success
  } catch {
    return false
  }
}
