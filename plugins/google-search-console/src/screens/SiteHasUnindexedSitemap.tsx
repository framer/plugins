import { useCallback, useContext, useState } from 'react';
import { GoogleToken, SiteWithGoogleSite } from '../types';
import { googleApiCall, sitemapUrl } from '../utils';
import { useErrorBoundary } from 'react-error-boundary';
import { AuthContext, useGoogleToken } from '../auth';
import Loading from '../components/Loading';
import sitemap from '../images/Sitemap@2x.png';
import confirmation from '../images/Confirmation@2x.png';

interface SiteHasUnindexedSitemapProps {
  site: SiteWithGoogleSite;
  sitemapUrl: string;
}

export default function SiteHasUnindexedSitemap({
  site,
}: SiteHasUnindexedSitemapProps) {
  const { showBoundary } = useErrorBoundary();

  const authContext = useContext(AuthContext) as NonNullable<GoogleToken>;

  const [status, setStatus] = useState<
    'pending' | 'loading' | 'success' | 'fail'
  >('pending');

  const { refresh } = useGoogleToken();

  const submit = useCallback(async () => {
    try {
      const currSitemapUrl = sitemapUrl(site.url);
      if (site.googleSite.siteUrl) {
        setStatus('loading');

        await googleApiCall<null>(
          `/webmasters/v3/sites/${encodeURIComponent(site.googleSite.siteUrl)}/sitemaps/${encodeURIComponent(currSitemapUrl)}`,
          authContext.access_token,
          refresh,
          {
            method: 'PUT',
          },
        );

        setStatus('success');
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

  if (status === 'loading') {
    return <Loading />;
  }

  if (status === 'success') {
    return (
      <div className="interstitial">
        <div className="interstitial-content">
          <img className="img-plus" src={confirmation} alt="" />
          <div>
            <p className="interstitial-title">Sitemap submitted</p>
            <p>
              Your sitemap has been submitted for indexing. Please check back
              later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="interstitial">
      <div className="interstitial-content">
        <img className="img-plus" src={sitemap} alt="" />
        <div>
          <p className="interstitial-title">Submit your sitemap</p>
          <p>Your sitemap has not been submitted for indexing yet.</p>
        </div>
      </div>
      <button type="button" onClick={submit}>
        Submit
      </button>
    </div>
  );
}
