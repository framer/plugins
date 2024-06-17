import { useCallback, useContext, useEffect, useState } from 'react';
import { GoogleSitemap, GoogleToken, SiteWithGoogleSite } from '../types';
import { googleApiCall, sitemapUrl } from '../utils';
import { AuthContext, useGoogleToken } from '../auth';
import SiteHasIndexedSitemap from './SiteHasIndexedSitemap';
import SiteHasUnindexedSitemap from './SiteHasUnindexedSitemap';
import Loading from '../components/Loading';

interface SiteViewProps {
  site: SiteWithGoogleSite;
}

export default function SiteView({ site }: SiteViewProps) {
  const [sitemapsState, setSitemapsState] = useState<{
    sitemaps: GoogleSitemap[] | null;
    submitted: boolean;
  } | null>(null);
  const currSitemapUrl = sitemapUrl(site.url);
  const [error, setError] = useState<Error>();

  const authContext = useContext(AuthContext) as NonNullable<GoogleToken>;

  const { refresh } = useGoogleToken();

  const fetchGoogleSitemaps = useCallback(
    async (siteUrl: string, token: string) => {
      const result = await googleApiCall<{ sitemap: GoogleSitemap[] }>(
        `/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`,
        token,
        refresh,
      );

      return (result?.sitemap as GoogleSitemap[]) || [];
    },
    [refresh],
  );

  useEffect(() => {
    async function update() {
      try {
        if (site.googleSite) {
          const sitemaps = await fetchGoogleSitemaps(
            site.googleSite.siteUrl,
            authContext.access_token,
          );
          const submittedSitemap = sitemaps?.find(
            (currSitemap) => currSitemap.path === currSitemapUrl,
          );

          setSitemapsState({ sitemaps, submitted: !!submittedSitemap });

          if (sitemaps && !submittedSitemap) {
            // console.log('Search Console debug submit sitemap', currSitemapUrl);
          }
        }
      } catch (e) {
        setError(e as Error);
      }
    }

    update();
  }, [
    authContext.access_token,
    currSitemapUrl,
    fetchGoogleSitemaps,
    site.googleSite,
    site.url,
  ]);

  if (error) {
    throw error;
  }

  if (!sitemapsState) {
    return <Loading />;
  }

  return sitemapsState.submitted ? (
    <SiteHasIndexedSitemap site={site} />
  ) : (
    <SiteHasUnindexedSitemap site={site} sitemapUrl={currSitemapUrl} />
  );
}
