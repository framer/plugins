/**
 * File path normalization utilities
 * Framer code files include extensions in their paths (.tsx, .ts, etc.)
 */

const firstCharacterRegex = /^[a-zA-Z$_]/
const remainingCharactersRegex = /[^a-zA-Z0-9$_]/g
const onlyDotsRegex = /^\.+$/
const tsxExtension = ".tsx"

enum NameType {
  Variable = "Variable",
  Selector = "Selector",
  Directory = "Directory",
}

interface SanitizedNameResult {
  path: string
  dirName: string
  name: string
  extension: string
}

function sanitizedName(type: NameType, name: string | null): string | null {
  if (!name) return null

  let validName = name.trim()
  if (validName.length === 0) return null
  const validFirstChar = type === NameType.Selector ? "_" : "$"

  if (type === NameType.Directory) {
    if (onlyDotsRegex.test(validName)) return null
  } else if (!firstCharacterRegex.test(validName)) {
    validName = validFirstChar + validName
  }

  validName = validName.replace(remainingCharactersRegex, "_")
  validName = validName.replace(/_+/g, "_")
  validName = validName.replace(/^\$_/u, validFirstChar)
  return validName
}

function sanitizedVariableName(name: string | null): string | null {
  return sanitizedName(NameType.Variable, name)
}

function sanitizedDirectoryName(name: string | null): string | null {
  return sanitizedName(NameType.Directory, name)
}

export function capitalizeFirstLetter(str: string): string {
  if (str.length === 0) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function hasValidExtension(fileName: string): boolean {
  if (fileName.endsWith(".json")) return true
  return /\.[tj]sx?$/u.test(fileName)
}

function splitExtension(fileName: string): [string, string] {
  const match = /^(.+?)(\.[^.]+)?$/.exec(fileName)
  if (!match) return [fileName, ""]
  return [match[1], match[2].slice(1)]
}

function dirname(filePath: string): string {
  const at = filePath.lastIndexOf("/")
  if (at < 0) return ""
  return filePath.slice(0, at)
}

function filename(filePath: string): string {
  const at = filePath.lastIndexOf("/") + 1
  return filePath.slice(at)
}

function pathJoin(...parts: string[]): string {
  let res = ""
  parts.forEach((part) => {
    while (part.startsWith("/")) part = part.slice(1)
    while (part.endsWith("/")) part = part.slice(0, -1)
    if (part === "") return
    if (res !== "") res += "/"
    res += part
  })
  return res
}

export function normalizePath(filePath: string): string {
  if (!filePath) return ""

  const isAbsolute = filePath.startsWith("/")
  const segments = filePath.replace(/\\/g, "/").split("/")
  const stack: string[] = []

  for (const segment of segments) {
    if (!segment || segment === ".") {
      continue
    }

    if (segment === "..") {
      if (stack.length > 0) {
        stack.pop()
      }
      continue
    }

    stack.push(segment)
  }

  const normalized = stack.join("/")
  if (isAbsolute) {
    return `/${normalized}`
  }

  return normalized
}

export function normalizeCodeFilePath(filePath: string): string {
  // Use proper path normalization that handles .., ., //, etc.
  // Always return relative paths (strip leading slash)
  const normalized = normalizePath(filePath)
  return normalized.startsWith("/") ? normalized.slice(1) : normalized
}

export function stripExtension(filePath: string): string {
  return normalizeCodeFilePath(filePath).replace(/\.(tsx?|jsx?)$/, "")
}

export function ensureExtension(filePath: string, extension = ".tsx"): string {
  const normalized = normalizeCodeFilePath(filePath)
  // Check if file already has a valid extension
  const hasValidExtension = /\.(tsx?|jsx?|json)$/i.test(normalized)
  return hasValidExtension ? normalized : `${normalized}${extension}`
}

export function canonicalFileName(filePath: string): string {
  // Keep the extension - just normalize the path
  // This prevents collisions between files with same name but different extensions
  return normalizeCodeFilePath(filePath)
}

export function sanitizeFilePath(
  input: string,
  capitalizeReactComponent = true
): SanitizedNameResult {
  const trimmed = input.trim()
  const [inputName, extension] = splitExtension(filename(trimmed))
  const extensionWithDot = extension ? `.${extension}` : ""

  const dirName = dirname(trimmed)
    .split("/")
    .map((part) => sanitizedDirectoryName(part))
    .filter((part): part is string => Boolean(part))
    .join("/")

  let name = sanitizedVariableName(inputName) ?? "MyComponent"
  if (
    (!hasValidExtension(extension) || extension === tsxExtension) &&
    capitalizeReactComponent
  ) {
    name = capitalizeFirstLetter(name)
  }

  const sanitizedPath = pathJoin(dirName, name + extensionWithDot)
  return { path: sanitizedPath, dirName, name, extension }
}

export function isSupportedExtension(filePath: string): boolean {
  return /\.(tsx?|jsx?|json)$/i.test(filePath)
}

/**
 * Pluralize a word based on count
 * @example pluralize(1, "file") => "1 file"
 * @example pluralize(3, "file") => "3 files"
 * @example pluralize(0, "conflict") => "0 conflicts"
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string
): string {
  const word = count === 1 ? singular : (plural ?? `${singular}s`)
  return `${count} ${word}`
}
