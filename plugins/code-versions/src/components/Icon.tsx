export function CodeVersionsIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={30} height={30} fill="none" {...props}>
            <path d="M0 0h30v30H0z" fill="#282828" />
            <g fill="#FFF">
                <path
                    d="M6 6h3v7.25A1.75 1.75 0 017.25 15H2a2 2 0 01-2-2v-1h6z"
                    opacity={0.5}
                    transform="rotate(-45 18.803 -1.425)"
                />
                <path d="M3 9H0V1.75C0 .784.784 0 1.75 0H7a2 2 0 012 2v1H3z" transform="rotate(-45 18.803 -1.425)" />
            </g>
        </svg>
    )
}
