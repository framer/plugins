export type DataSourceFieldType =
    | "string"
    | "date"
    | "image"
    | "reference"
    | "richText"
    | "number"
    | "boolean"
    | "enum"
    | "color"

export type DataSourceField =
    | {
          type: Exclude<DataSourceFieldType, "reference" | "enum">
      }
    | {
          type: "reference"
          reference: string
          multiple: boolean
      }
    | {
          type: "enum"
          options: string[]
      }

export interface DataSource {
    id: string
    fields: Record<string, DataSourceField>
    items: Record<string, unknown>[]
}

/**
 * List of data sources available in the CMS.
 */
export async function listDataSourcesIds(): Promise<string[]> {
    return ["articles", "categories"]
}

export async function getDataSources(collection: string): Promise<DataSource> {
    return await fetch(`/datasources/${collection}.json`).then(res => res.json())
}
