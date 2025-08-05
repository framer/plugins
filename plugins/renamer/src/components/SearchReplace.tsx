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
    onRenameClick: (e?: React.FormEvent) => void
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
    return (
        <form className="search-replace" onSubmit={e => onRenameClick(e)}>
            <TextField
                placeholder="Find"
                value={query}
                setValue={setQuery}
                disabled={loading}
                leadingContent={<SearchIcon />}
                autoFocus
            />

            {showReplacement && (
                <TextField placeholder="Rename To…" value={replacement} setValue={setReplacement} disabled={loading} />
            )}

            <button
                type="submit"
                className="rename-button"
                disabled={!query || disableAction || !isAllowed}
                title={isAllowed ? undefined : "Insufficient permissions"}
            >
                {loading ? <div className="framer-spinner" /> : actionLabel}
            </button>
        </form>
    )
}
