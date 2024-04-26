import { DatabaseObjectResponse } from "@notionhq/client/build/src/api-endpoints"

interface IconProps {
    className?: string
}

export function IconChevron() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="5" height="8">
            <path
                d="M 1 1 L 4 4 L 1 7"
                fill="transparent"
                strokeWidth="1.5"
                stroke="currentColor"
                strokeLinecap="round"
            ></path>
        </svg>
    )
}

export function ReloadIcon({ className }: IconProps) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" className={className}>
            <path
                d="M 1.393 4.054 C 1.646 3.456 2.012 2.917 2.464 2.464 C 3.369 1.56 4.619 1 6 1 C 7.381 1 8.631 1.56 9.536 2.464 C 9.762 2.691 9.966 2.938 10.146 3.204"
                fill="transparent"
                strokeWidth="1.5"
                stroke="currentColor"
                strokeLinecap="round"
            ></path>
            <path
                d="M 11 1 L 11 4 L 8 4"
                fill="transparent"
                strokeWidth="1.5"
                stroke="currentColor"
                strokeLinecap="round"
            ></path>
            <path
                d="M 4 8 L 1 8 L 1 11"
                fill="transparent"
                strokeWidth="1.5"
                stroke="currentColor"
                strokeLinecap="round"
            ></path>
            <path
                d="M 10.607 7.946 C 10.354 8.544 9.988 9.083 9.536 9.536 C 8.631 10.44 7.381 11 6 11 C 4.619 11 3.369 10.44 2.464 9.536 C 2.238 9.309 2.034 9.062 1.854 8.796"
                fill="transparent"
                strokeWidth="1.5"
                stroke="currentColor"
                strokeLinecap="round"
            ></path>
        </svg>
    )
}

export function NotionIcon({ icon }: { icon: DatabaseObjectResponse["icon"] }) {
    if (icon?.type === "external") {
        return <img src={icon.external.url} className="max-w-[32px]" />
    }

    if (icon?.type === "emoji") {
        return <span className="">{icon.emoji}</span>
    }

    return <div>NoIcon</div>
}
