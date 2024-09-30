import { useCallback, useContext, useEffect, useState } from 'react';
import { GoogleSitemap, GoogleToken, SiteWithGoogleSite } from '../types';
import { googleApiCall, sitemapUrl } from '../utils';
import { AuthContext, useGoogleToken } from '../auth';
import SiteHasIndexedSitemap from './SiteHasIndexedSitemap';
import SiteHasUnindexedSitemap from './SiteHasUnindexedSitemap';
import Loading from '../components/Loading';
import { GoogleError } from '../errors';
import NeedsVerify from './NeedsVerify';

interface SiteViewProps {
  site: SiteWithGoogleSite;
  logout: () => void;
}

// Change this to true to show mock sitemap data for testing.
const SHOW_MOCK_SITEMAP_DATA = !!import.meta.env.VITE_MOCK_DATA;

export default function SiteView({ site, logout }: SiteViewProps) {
  const [sitemapsState, setSitemapsState] = useState<{
    sitemaps: GoogleSitemap[] | null;
    submitted: boolean;
  } | null>(null);
  const currSitemapUrl = sitemapUrl(site.url);
  const [error, setError] = useState<{
    level: 'throw' | 'display';
    e: Error;
  } | null>(null);

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

  const update = useCallback(async () => {
    setError(null);

    if (SHOW_MOCK_SITEMAP_DATA) {
      return;
    }

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
      if (((e as GoogleError)?.cause as { status: number })?.status === 403) {
        setError({ level: 'display', e: e as unknown as GoogleError });
      } else {
        setError({ level: 'throw', e: e as unknown as GoogleError });
      }
    }
  }, [
    authContext.access_token,
    currSitemapUrl,
    fetchGoogleSitemaps,
    site.googleSite,
  ]);

  useEffect(() => {
    update();
  }, [update]);

  if (error) {
    if (error.level === 'throw') {
      throw error.e;
    } else {
      return <NeedsVerify site={site} logout={logout} retry={update} />;
    }
  }

  if (!sitemapsState && !SHOW_MOCK_SITEMAP_DATA) {
    return <Loading />;
  }

  return sitemapsState?.submitted || SHOW_MOCK_SITEMAP_DATA ? (
    <SiteHasIndexedSitemap site={site} logout={logout} />
  ) : (
    <SiteHasUnindexedSitemap site={site} sitemapUrl={currSitemapUrl} />
  );
}
