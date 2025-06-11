import type { DatabaseObjectResponse } from "@notionhq/client/build/src/api-endpoints"

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

export function NotionIcon({ icon }: { icon: DatabaseObjectResponse["icon"] }) {
    if (icon?.type === "external") {
        return <img src={icon.external.url} className="max-w-[32px]" />
    }

    if (icon?.type === "emoji") {
        return <span className="">{icon.emoji}</span>
    }

    return <div>NoIcon</div>
}
