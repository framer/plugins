import { useCallback, useContext } from 'react';
import { GoogleToken, SiteWithGoogleSite } from '../types';
import { googleApiCall, sitemapUrl } from '../utils';
import { useErrorBoundary } from 'react-error-boundary';
import { AuthContext, useGoogleToken } from '../auth';

interface SiteHasUnindexedSitemapProps {
  site: SiteWithGoogleSite;
  sitemapUrl: string;
}

export default function SiteHasUnindexedSitemap({
  site,
}: SiteHasUnindexedSitemapProps) {
  const { showBoundary } = useErrorBoundary();

  const authContext = useContext(AuthContext) as NonNullable<GoogleToken>;

  const { refresh } = useGoogleToken();

  const submit = useCallback(async () => {
    try {
      const currSitemapUrl = sitemapUrl(site.url);
      if (site.googleSite.siteUrl) {
        const result = await googleApiCall(
          `/webmasters/v3/sites/${encodeURIComponent(site.googleSite.siteUrl)}/sitemaps/${encodeURIComponent(currSitemapUrl)}`,
          authContext.access_token,
          refresh,
          {
            method: 'PUT',
          },
        );
      }
    } catch (e) {
      showBoundary(e);
    }
  }, [
    authContext.access_token,
    refresh,
    showBoundary,
    site.googleSite.siteUrl,
    site.url,
  ]);

  return (
    <div>
      <p>Your sitemap has not been submitted for indexing yet.</p>
      <button type="button" onClick={submit}>
        Submit Sitemap
      </button>
    </div>
  );
}
