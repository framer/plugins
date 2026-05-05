const statUnits = ["", "K", "M", "B", "T", "P", "E"] as const

export function formatStat(value: number) {
    if (!Number.isFinite(value)) {
        return "—"
    }

    const sign = value < 0 ? "-" : ""
    let scaledValue = Math.abs(value)
    let unitIndex = 0

    while (scaledValue >= 1000 && unitIndex < statUnits.length - 1) {
        scaledValue /= 1000
        unitIndex += 1
    }

    if (scaledValue >= 1000) {
        return value.toString()
    }

    let roundedValue = Number.isInteger(scaledValue) ? scaledValue : Number(scaledValue.toFixed(1))

    while (roundedValue >= 1000 && unitIndex < statUnits.length - 1) {
        roundedValue /= 1000
        unitIndex += 1
    }

    const unit = statUnits[unitIndex] ?? ""

    return `${sign}${roundedValue.toString()}${unit}`
}
