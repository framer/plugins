import type { ManagedCollectionFieldInput } from "framer-plugin"

// There is no endpoint to retrieve all possible fields dynamically since blog fields are fixed,
// This does not included all possible fields, just the CMS relevant ones.
export const HUBSPOT_BLOG_FIELDS: ManagedCollectionFieldInput[] = [
    {
        name: "ID", // Unique ID of the blog post
        type: "string",
        id: "id",
        userEditable: false,
    },
    {
        name: "Internal Name", // Internal name of the blog post
        type: "string",
        id: "name",
        userEditable: false,
    },
    {
        name: "Title", // HTML <title> for SEO
        type: "string",
        id: "htmlTitle",
        userEditable: false,
    },
    {
        name: "Meta Description", // Meta description for SEO
        type: "string",
        id: "metaDescription",
        userEditable: false,
    },
    {
        name: "URL", // Full URL of the blog post
        type: "link",
        id: "url",
        userEditable: false,
    },
    {
        name: "Language", // Language code (e.g., "en_US")
        type: "string",
        id: "language",
        userEditable: false,
    },
    {
        name: "Publish Date", // Scheduled publish date (ISO8601 format)
        type: "date",
        id: "publishDate",
        userEditable: false,
    },
    {
        name: "Created", // Creation date (UTC format)
        type: "date",
        id: "created",
        userEditable: false,
    },
    {
        name: "Updated", // Last updated date
        type: "date",
        id: "updated",
        userEditable: false,
    },
    {
        name: "Author Name", // Name of the blog post author
        type: "string",
        id: "authorName",
        userEditable: false,
    },
    {
        name: "Post Summary", // Summary or excerpt of the blog post
        type: "formattedText",
        id: "postSummary",
        userEditable: false,
    },
    {
        name: "RSS Summary", // Summary specifically for RSS feeds
        type: "formattedText",
        id: "rssSummary",
        userEditable: false,
    },
    {
        name: "Post Body", // Main HTML content of the blog post
        type: "formattedText",
        id: "postBody",
        userEditable: false,
    },
    {
        name: "Featured Image", // URL to the featured image
        type: "image",
        id: "featuredImage",
        userEditable: false,
    },
    {
        name: "Featured Image Alt Text", // Alt text for the featured image
        type: "string",
        id: "featuredImageAltText",
        userEditable: false,
    },
    {
        name: "Use Featured Image", // Determines if a featured image should be used
        type: "boolean",
        id: "useFeaturedImage",
        userEditable: false,
    },
    {
        name: "Canonical URL", // Canonical URL override for SEO
        type: "string",
        id: "linkRelCanonicalUrl",
        userEditable: false,
    },
    {
        name: "Campaign", // GUID of the marketing campaign
        type: "string",
        id: "campaign",
        userEditable: false,
    },
    {
        name: "Content Group ID", // ID of the parent Blog
        type: "string",
        id: "contentGroupId",
        userEditable: false,
    },
    {
        name: "Blog Author ID", // ID of the Blog Author associated
        type: "string",
        id: "blogAuthorId",
        userEditable: false,
    },
    {
        name: "State", // ENUM describing the current state of the blog post
        type: "string",
        id: "state",
        userEditable: false,
    },
    {
        name: "Currently Published", // Boolean for current publish status
        type: "boolean",
        id: "currentlyPublished",
        userEditable: false,
    },
    {
        name: "Archived in Dashboard", // Boolean to determine if it is archived in the dashboard
        type: "boolean",
        id: "archivedInDashboard",
        userEditable: false,
    },
    {
        name: "Public Access Rules Enabled", // Boolean to respect public access rules
        type: "boolean",
        id: "publicAccessRulesEnabled",
        userEditable: false,
    },
    {
        name: "Publish Immediately", // Boolean to publish immediately
        type: "boolean",
        id: "publishImmediately",
        userEditable: false,
    },
    {
        name: "Translated From ID", // ID of the primary blog post translated from
        type: "string",
        id: "translatedFromId",
        userEditable: false,
    },
    {
        name: "Dynamic Page HubDB Table ID", // ID of the HubDB table this blog post references
        type: "string",
        id: "dynamicPageHubDbTableId",
        userEditable: false,
    },
]
