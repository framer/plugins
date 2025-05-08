import CategoryDataSource from "./categories"
import type { DataSource, Field } from "./types"

const idField: Field = { id: "id", name: "Id", type: "string" }
const titleField: Field = { id: "title", name: "Title", type: "string" }
const contentField: Field = { id: "content", name: "Content", type: "formattedText" }
const readingTimeField: Field = { id: "readingTime", name: "Reading Time", type: "number" }
const featuredField: Field = { id: "featured", name: "Featured", type: "boolean" }
const categoriesField: Field = {
    id: "categories",
    name: "Categories",
    type: "multiCollectionReference",
    collection: CategoryDataSource,
}

const fields: Field[] = [idField, titleField, contentField, readingTimeField, featuredField, categoriesField]

const ArticleDataSource: DataSource = {
    id: "articles",
    fields,
    idField: idField,
    slugField: titleField,
}

export default ArticleDataSource
