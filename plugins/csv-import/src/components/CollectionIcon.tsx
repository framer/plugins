export function CollectionIcon({ color = "currentColor" }: { color?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="12" fill="none" overflow="visible">
            <path
                d="M 5 0 C 7.762 0 10 1.119 10 2.5 C 10 3.881 7.762 5 5 5 C 2.239 5 0 3.881 0 2.5 C 0 1.119 2.239 0 5 0 Z M 10 6 C 10 7.381 7.762 8.5 5 8.5 C 2.239 8.5 0 7.381 0 6 L 0 4 C 0 5.381 2.239 6.5 5 6.5 C 7.762 6.5 10 5.381 10 4 Z M 10 9.5 C 10 10.881 7.762 12 5 12 C 2.239 12 0 10.881 0 9.5 L 0 7.5 C 0 8.881 2.239 10 5 10 C 7.762 10 10 8.881 10 7.5 Z"
                fill={color}
            ></path>
        </svg>
    )
}
