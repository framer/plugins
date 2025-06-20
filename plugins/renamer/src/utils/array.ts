// From: https://gist.github.com/anthonyec/ec86c518d9729c1e208a9fdc8e89e8de

/**
 * Return a copy of the array with the element added to the start.
 */
export function prepend<T>(array: T[], value: T): T[] {
    return [value, ...array]
}

/**
 * Return a copy of the array the element added to the end.
 */
export function append<T>(array: T[], value: T): T[] {
    return [...array, value]
}

/**
 * Return a copy of the array with the element inserted at a specific index.
 */
export function insertAt<T>(array: T[], index: number, value: T): T[] {
    return [...array.slice(0, index), value, ...array.slice(index, array.length)]
}

export function replaceAt<T>(array: T[], index: number, value: T): T[] {
    return [...array.slice(0, index), value, ...array.slice(index + 1)]
}

/**
 * Return a copy of the array with the element at a specific index removed.
 */
export function removeAt<T>(array: T[], index: number): T[] {
    return [...array.slice(0, index), ...array.slice(index + 1)]
}

/**
 * Return a copy of the array with the specified element removed. Uses strict
 * equality to find said element.
 */
export function remove<T>(array: T[], element: T): T[] {
    const index = array.findIndex(otherElement => element === otherElement)
    if (index === -1) return [...array]

    return removeAt(array, index)
}

/**
 * Returns the first element of the array.
 */
export function first<T>(array: T[]): NonNullable<T> | undefined {
    const item = array[0]
    if (item === undefined || item === null) return

    return item
}

/**
 * Returns the last element of the array.
 */
export function last<T>(array: T[]): NonNullable<T> | undefined {
    const item = array[array.length - 1]
    if (item === undefined || item === null) return

    return item
}

/**
 * Returns a reversed copy of the array.
 */
export function reverse<T>(array: T[]): T[] {
    return [...array].reverse()
}

/**
 * Returns a sorted copy of the array.
 */
export function sort<T>(array: T[], compare?: (a: T, b: T) => number): T[] {
    return [...array].sort(compare)
}

/**
 * Returns the element before a specific index.
 *
 * If the index is out of range, `undefined` is returned.
 */
export function previous<T>(array: T[], index: number): NonNullable<T> | undefined {
    if (index === 0) return

    const item = array[index - 1]
    if (item === undefined || item === null) return

    return item
}

/**
 * Returns the element after a specific index.
 *
 * If the index is out of range, `undefined` is returned.
 */
export function next<T>(array: T[], index: number): NonNullable<T> | undefined {
    if (index >= array.length - 1) return

    const item = array[index + 1]
    if (item === undefined || item === null) return

    return item
}

export function forwards(iterations: number): number {
    return iterations + 1
}

export function backwards(iterations: number, length: number): number {
    return length - 1 - iterations
}

export function skip(every: number): IterationBehaviour {
    return (iterations: number): number => {
        return iterations * every
    }
}

type IterationBehaviour = (iterations: number, length: number) => number

/**
 * Iterator with useful information about the loop built in. These include the
 * previous, current and next element. And if the iteration is at the start or
 * end.
 */
export function iterate<T>(array: T[], behaviour: IterationBehaviour = forwards) {
    return {
        [Symbol.iterator]() {
            let index = behaviour(-1, array.length)
            let iterations = 0

            return {
                next() {
                    if (iterations > array.length * 3) {
                        throw Error("Infinite loop protection")
                    }

                    const value = {
                        index,
                        current: array[index],
                        previous: previous(array, index),
                        next: next(array, index),
                        isFirst: index === 0,
                        isLast: index === array.length - 1,
                    }

                    if (index >= 0 && index < array.length) {
                        index = behaviour(iterations, array.length)
                        iterations += 1
                        return { value, done: false }
                    }

                    return { value: value, done: true }
                },
            }
        },
    }
}
