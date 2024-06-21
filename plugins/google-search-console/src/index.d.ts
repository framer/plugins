declare module 'sitemap-urls' {
  export function extractUrls(sitemap: string): Promise<string[]>;
}
