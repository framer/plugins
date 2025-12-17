import { useRef } from "react"

// Only init the constant once
export function useConstant<T>(init: () => T): T {
  const ref = useRef<T | null>(null)

  if (ref.current === null) {
    ref.current = init()
  }

  return ref.current
}
