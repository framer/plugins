/** Type-respecting `Object.entries` */
export function entries<T extends object>(object: T): [keyof T, T[keyof T]][] {
    return Object.entries(object) as [keyof T, T[keyof T]][]
}

export type ReadonlyRecord<K extends string | number | symbol, V> = { readonly [key in K]: V }
