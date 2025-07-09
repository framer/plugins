export function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center space-y-3 h-screen w-screen animate-(--fade-in-animation) opacity-0">
            <img src="/logo.svg" className="rounded-lg size-6" aria-hidden />

            <div className="space-y-2 text-center max-w-36">
                <h2 className="font-semibold text-framer-text-primary text-xs leading-[1.2]">Code Versions</h2>
                <p className="text-framer-text-tertiary text-xs leading-[1.5]">
                    Select a Code Component to restore previous versions.
                </p>
            </div>
        </div>
    )
}
