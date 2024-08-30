import { Spinner } from "./Spinner"

export const CenteredSpinner = () => (
    <div className="w-full h-full flex items-center justify-center">
        <Spinner size="medium" inheritColor />
    </div>
)
