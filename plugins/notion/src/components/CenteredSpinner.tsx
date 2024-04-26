import { Spinner } from "./Spinner"

export function CenteredSpinner() {
    return (
        <div className="w-full h-full flex items-center justify-center">
            <Spinner size="medium" />
        </div>
    )
}
