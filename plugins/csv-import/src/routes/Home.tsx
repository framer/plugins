import type { Collection } from "framer-plugin"
import { CollectionSelector } from "../components/CollectionSelector"
import { SelectCSVFile } from "../components/SelectCSVFile"

interface HomeProps {
    collection: Collection | null
    forceCreateCollection?: boolean
    onCollectionChange: (collection: Collection) => void
    onFileSelected: (csvContent: string) => Promise<void>
}

export function Home({ collection, onCollectionChange, onFileSelected, forceCreateCollection }: HomeProps) {
    return (
        <div className="import-collection">
            <hr />

            <CollectionSelector
                forceCreate={forceCreateCollection}
                collection={collection}
                onCollectionChange={onCollectionChange}
            />

            <hr />

            <SelectCSVFile disabled={!collection} onFileSelected={onFileSelected} />
        </div>
    )
}
