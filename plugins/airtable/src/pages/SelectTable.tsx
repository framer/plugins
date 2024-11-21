import { framer } from "framer-plugin"
import React, { useEffect, useState } from "react"
import { useBaseSchemaQuery, useBasesQuery } from "../api"
import { Hero } from "../components/Hero"

type SelectChangeEvent = React.ChangeEvent<HTMLSelectElement>

interface Props {
    onTableSelected: (baseId: string, tableId: string) => void
}

export function SelectTablePage({ onTableSelected }: Props) {
    const [selectedBaseId, setSelectedBaseId] = useState("")
    const [selectedTableId, setSelectedTableId] = useState("")

    const { data: bases, isFetching: isFetchingBases } = useBasesQuery()
    const { data: baseSchema, isFetching: isFetchingSchemas } = useBaseSchemaQuery(selectedBaseId)

    const handleBaseSelect = (e: SelectChangeEvent) => {
        setSelectedBaseId(e.target.value)
        setSelectedTableId("")
    }

    const handleTableSelect = (e: SelectChangeEvent) => {
        setSelectedTableId(e.target.value)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (!selectedBaseId || !selectedTableId) {
            framer.notify("Please select a base and table", { variant: "error" })
            return
        }

        onTableSelected(selectedBaseId, selectedTableId)
    }

    useEffect(() => {
        if (!bases) return
        if (bases.length === 0) return

        setSelectedBaseId(bases[0].id)
    }, [bases])

    useEffect(() => {
        if (!baseSchema) return
        if (baseSchema.tables.length === 0) return

        setSelectedTableId(baseSchema.tables[0].id)
    }, [baseSchema])

    return (
        <form className="col-lg" onSubmit={handleSubmit}>
            <Hero />
            <div className="col pl-[15px]">
                <div className="row justify-between">
                    <p>Base</p>
                    <select onChange={handleBaseSelect} value={selectedBaseId || ""} className="w-[164px]">
                        <option value="" disabled>
                            {isFetchingBases ? "Loading..." : "Choose..."}
                        </option>
                        {bases?.map(base => (
                            <option key={base.id} value={base.id}>
                                {base.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="row justify-between">
                    <p>Table</p>
                    <select onChange={handleTableSelect} value={selectedTableId || ""} className="w-[164px]">
                        <option value="" disabled>
                            {isFetchingSchemas ? "Loading..." : "Choose..."}
                        </option>
                        {baseSchema?.tables.map(table => (
                            <option key={table.id} value={table.id}>
                                {table.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <button>Next</button>
        </form>
    )
}
