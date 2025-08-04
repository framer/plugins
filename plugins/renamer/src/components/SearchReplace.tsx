import SearchIcon from "./SearchIcon"
import TextField from "./TextField"

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
    onRenameClick,
}: Props) {
    const handleTextFieldKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "Enter" && onRenameClick) {
            onRenameClick()
        }
    }

    return (
        <div className="search-replace">
            <TextField
                placeholder="Find"
                value={query}
                setValue={setQuery}
                disabled={loading}
                onKeyDown={handleTextFieldKeyDown}
                leadingContent={<SearchIcon />}
                autoFocus
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
                {loading ? <div className="framer-spinner" /> : actionLabel}
            </button>
        </div>
    )
}
