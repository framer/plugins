import { ManagedCollectionField } from "framer-plugin"

export const SHOT_FIELDS: ManagedCollectionField[] = [
    {
        id: "id",
        name: "Id",
        type: "number",
        userEditable: false,
    },
    {
        id: "title",
        name: "Title",
        type: "string",
        userEditable: false,
    },
    {
        id: "images.hidpi",
        name: "Image",
        type: "image",
        userEditable: false,
    },
    {
        id: "low_profile",
        name: "Low Profile",
        type: "boolean",
        userEditable: false,
    },
    {
        id: "html_url",
        name: "URL",
        type: "link",
        userEditable: false,
    },
    {
        id: "published_at",
        name: "Published At",
        type: "date",
        userEditable: false,
    },
    {
        id: "updated_at",
        name: "Updated At",
        type: "date",
        userEditable: false,
    },
    {
        id: "animated",
        name: "Animated",
        type: "boolean",
        userEditable: false,
    },
    // These fields SHOULD work but the Dribbble API
    // returns null for some reason
    // {
    //     id: "description",
    //     name: "Description",
    //     type: "formattedText",
    //     userEditable: false,
    // },
    // {
    //     id: "video.url",
    //     name: "Video",
    //     type: "image",
    //     userEditable: false,
    // },
]
