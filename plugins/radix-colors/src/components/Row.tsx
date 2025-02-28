type RowProps = {
    children: React.ReactNode
    title: string
}

export const Row = ({ children, title }: RowProps) => {
    return (
        <div className="row">
            <label>{title}</label>
            {children}
        </div>
    )
}
