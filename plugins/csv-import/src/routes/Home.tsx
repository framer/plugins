import type { Collection } from "framer-plugin"
import { CollectionSelector } from "../components/CollectionSelector"
import { SelectCSVFile } from "../components/SelectCSVFile"

interface HomeProps {
    collection: Collection | null
    onCollectionChange: (collection: Collection) => void
    onFileSelected: (csvContent: string) => Promise<void>
}

export function Home({ collection, onCollectionChange, onFileSelected }: HomeProps) {
    return (
        <div className="import-collection">
            <CollectionSelector collection={collection} onCollectionChange={onCollectionChange} />

            {collection ? (
                <SelectCSVFile onFileSelected={onFileSelected} />
            ) : (
                <div className="intro no-border">
                    <p>Select a collection to import CSV data into.</p>
                </div>
            )}
        </div>
    )
}
