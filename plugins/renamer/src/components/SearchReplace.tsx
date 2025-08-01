import iconSearch from "../assets/icon_search.svg?raw"
import Spinner from "./Spinner"
import TextField from "./TextField"
import "./SearchReplace.css"

interface Props {
    query: string
    setQuery: (query: string) => void
    replacement: string
    setReplacement: (replacement: string) => void
    loading: boolean
    disableAction: boolean
    actionLabel: string
    showReplacement: boolean
    isAllowed: boolean
    onRenameClick?: () => void
}

export default function SearchReplace({
    query,
    setQuery,
    replacement,
    setReplacement,
    loading,
    disableAction,
    actionLabel,
    showReplacement,
    isAllowed,
    onRenameClick = () => {},
}: Props) {
    const handleTextFieldKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "Enter") {
            onRenameClick()
        }
    }

    return (
        <div className="search-replace">
            <TextField
                placeholder="Find"
                value={query}
                setValue={setQuery}
                focused={false}
                disabled={loading}
                onKeyDown={handleTextFieldKeyDown}
                leadingContent={<div dangerouslySetInnerHTML={{ __html: iconSearch }} />}
            />

            {showReplacement && (
                <TextField
                    placeholder="Rename To…"
                    value={replacement}
                    setValue={setReplacement}
                    disabled={loading}
                    onKeyDown={handleTextFieldKeyDown}
                />
            )}

            <button
                className="rename-button"
                onClick={onRenameClick}
                disabled={!query || disableAction || !isAllowed}
                title={isAllowed ? undefined : "Insufficient permissions"}
            >
                {loading ? <Spinner type="solid" /> : actionLabel}
            </button>
        </div>
    )
}
