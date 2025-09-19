export function ResultMessage({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex-1 flex justify-center items-center select-none">
            <div className="text-center text-tertiary-light dark:text-tertiary-dark text-xs">{children}</div>
        </div>
    )
}
