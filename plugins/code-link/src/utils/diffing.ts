/** Compute line-based diff: lines added/removed going from `from` to `to` */
export function computeLineDiff(
  from: string,
  to: string
): { added: number; removed: number } {
  const fromLines = from.split("\n")
  const toLines = to.split("\n")
  const fromSet = new Set(fromLines)
  const toSet = new Set(toLines)

  let added = 0
  let removed = 0

  for (const line of toLines) {
    if (!fromSet.has(line)) added++
  }
  for (const line of fromLines) {
    if (!toSet.has(line)) removed++
  }

  return { added, removed }
}
