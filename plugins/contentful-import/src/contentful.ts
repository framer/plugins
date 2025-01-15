import { createClient, ContentfulClientApi } from 'contentful'
import type { ManagedCollectionField } from "framer-plugin"

interface ContentfulConfig {
    space: string
    accessToken: string
}

type ContentfulEntry = {
    sys: {
        id: string
        type: string
        contentType: {
            sys: {
                id: string
            }
        }
    }
    fields: Record<string, unknown>
}

let contentfulClient: ContentfulClientApi<undefined> | null = null

export const initContentful = (config: ContentfulConfig) => {
    contentfulClient = createClient({
        space: config.space,
        accessToken: config.accessToken,
    })
}

export const getContentTypes = async () => {
    if (!contentfulClient) throw new Error('Contentful client not initialized')
    const response = await contentfulClient.getContentTypes()
    return response.items
}

export const getEntriesForContentType = async (contentTypeId: string) => {
    if (!contentfulClient) throw new Error('Contentful client not initialized')
    const entries = await contentfulClient.getEntries({
        content_type: contentTypeId,
        include: 10 // Include linked entries
    })
    console.log('Raw Contentful entries:', JSON.stringify(entries, null, 2))
    return entries.items
}

export const mapContentfulToFramerCollection = async (
    contentTypeId: string, 
    entries: ContentfulEntry[]
) => {
    if (entries.length === 0) {
        throw new Error('No entries found for this content type')
    }

    // Get the content type to access field definitions
    if (!contentfulClient) throw new Error('Contentful client not initialized')
    const contentType = await contentfulClient.getContentType(contentTypeId)
    console.log('Raw Contentful content type:', JSON.stringify(contentType, null, 2))
    console.log('Content type:', {
        id: contentType.sys.id,
        name: contentType.name,
        displayField: contentType.displayField,
        fields: contentType.fields.map(f => ({
            id: f.id,
            name: f.name,
            type: f.type,
            linkType: f.linkType,
            items: f.items,
            required: f.required,
            validations: f.validations
        }))
    })

    // Map Contentful fields to Framer schema using content type definition
    const fields: ManagedCollectionField[] = contentType.fields.map((field): ManagedCollectionField => {
        console.log('Mapping field:', {
            id: field.id,
            name: field.name,
            type: field.type,
            linkType: field.linkType,
            items: field.items
        })

        const baseField = {
            id: field.id,
            name: field.name,
            userEditable: true,
        }

        // Map Contentful field types to Framer field types
        switch (field.type) {
            case 'Integer':
            case 'Number':
                return { ...baseField, type: 'number' }
            case 'Boolean':
                return { ...baseField, type: 'boolean' }
            case 'Date':
                return { ...baseField, type: 'date' }
            case 'Text':
            case 'Symbol':
                return { ...baseField, type: 'string' }
            case 'RichText':
                return { ...baseField, type: 'formattedText' }
            case 'Link':
                if (field.linkType === 'Asset') {
                    return { ...baseField, type: 'image' }
                }
                if (field.linkType === 'Entry') {
                    // For Entry references, we need to store the ID
                    return { ...baseField, type: 'string' }
                }
                return { ...baseField, type: 'string' }
            case 'Array':
                if (field.items?.type === 'Link') {
                    if (field.items.linkType === 'Asset') {
                        // For arrays of assets (e.g., multiple images)
                        return { ...baseField, type: 'image' }
                    }
                    if (field.items.linkType === 'Entry') {
                        // For arrays of references, store as comma-separated IDs
                        return { ...baseField, type: 'string' }
                    }
                }
                // For arrays of primitives
                return { ...baseField, type: 'string' }
            default:
                return { ...baseField, type: 'string' }
        }
    })

    console.log('Mapped Framer fields:', fields)

    // Helper function to safely extract field values
    const extractFieldValue = (value: unknown, fieldType: string, linkType?: string): string | string[] => {
        if (value === null || value === undefined) return ''

        if (fieldType === 'Array' && Array.isArray(value)) {
            return value.map(item => {
                if (item && typeof item === 'object' && 'sys' in item && 'fields' in item) {
                    if (item.sys.type === 'Asset' && 'file' in item.fields) {
                        const file = item.fields.file as { url?: string }
                        return file.url || ''
                    }
                    if (item.sys.type === 'Entry') {
                        return item.sys.id
                    }
                }
                return String(item)
            }).filter(Boolean)
        }

        if (fieldType === 'Link' && typeof value === 'object' && value !== null) {
            const item = value as { sys?: { type?: string; id?: string }, fields?: { file?: { url?: string } } }
            if (item.sys?.type === 'Asset' && linkType === 'Asset') {
                return item.fields?.file?.url || ''
            }
            if (item.sys?.type === 'Entry' && linkType === 'Entry' && item.sys.id) {
                return item.sys.id
            }
            return ''
        }

        if (fieldType === 'RichText') {
            if (typeof value === 'object' && value !== null) {
                const richText = value as { content?: Array<{ value?: string }> }
                if (Array.isArray(richText.content)) {
                    return richText.content.map(node => node.value || '').join('\n')
                }
            }
            return ''
        }

        return String(value)
    }

    // Map entries to Framer collection items
    const items = entries.map(entry => {
        const fields = entry.fields as Record<string, unknown>
        
        // Get the slug from the display field if available, or fall back to ID
        const displayField = contentType.displayField
        const slug = displayField ? String(fields[displayField] || entry.sys.id) : entry.sys.id

        const item = {
            id: String(entry.sys.id),
            slug,
            fieldData: contentType.fields.reduce((acc, field) => {
                const value = fields[field.id]
                acc[field.id] = extractFieldValue(value, field.type, field.linkType)
                return acc
            }, {} as Record<string, string | string[]>)
        }

        console.log('Mapped item:', JSON.stringify(item, null, 2))
        return item
    })

    return {
        fields,
        items
    }
} 