import { type PublishInfo, framer } from 'framer-plugin';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ErrorBoundary, useErrorBoundary } from 'react-error-boundary';
import './App.css';
import { AuthContext, useGoogleToken } from './auth';
import Loading from './components/Loading';
import { LARGE_HEIGHT, PLUGIN_WIDTH, SMALL_HEIGHT } from './constants';
import { mockSiteInfo } from './mocks';
import CriticalError from './screens/CriticalError';
import GoogleLogin from './screens/GoogleLogin';
import NeedsPublish from './screens/NeedsPublish';
import SiteView from './screens/SiteView';
import type {
  GoogleSite,
  GoogleToken,
  Site,
  SiteWithGoogleSite,
} from './types';
import { googleApiCall, stripTrailingSlash } from './utils';

framer.showUI({
  position: 'top right',
  width: PLUGIN_WIDTH,
  height: SMALL_HEIGHT,
  minWidth: PLUGIN_WIDTH,
  minHeight: SMALL_HEIGHT,
});

// Change this to true to show mock sitemap data for testing.
const SHOW_MOCK_SITEMAP_DATA = !!import.meta.env.VITE_MOCK_DATA;

function usePublishedSite() {
  const [publishInfo, setPublishInfo] = useState<PublishInfo | null>(null);
  const [siteInfo, setSiteInfo] = useState<Site>();
  const { showBoundary } = useErrorBoundary();

  const [needsPublish, setNeedsPublish] = useState(false);

  const authContext = useContext(AuthContext) as NonNullable<GoogleToken>;

  useEffect(() => {
    return framer.subscribeToPublishInfo(setPublishInfo);
  }, []);

  const { refresh } = useGoogleToken();

  const fetchGoogleSites = useCallback(
    async (token: string): Promise<Array<GoogleSite>> => {
      const result = await googleApiCall<{ siteEntry: Array<GoogleSite> }>(
        `/webmasters/v3/sites`,
        token,
        refresh,
      );

      return result?.siteEntry || [];
    },
    [refresh],
  );

  useEffect(() => {
    async function update() {
      if (SHOW_MOCK_SITEMAP_DATA) {
        return;
      }

      try {
        if (publishInfo) {
          if (publishInfo.production?.url) {
            const domain = new URL(publishInfo.production.url).hostname;

            const googleSites = await fetchGoogleSites(
              authContext.access_token,
            );

            const url = stripTrailingSlash(publishInfo.production.url);

            let googleSite =
              googleSites.find(
                (currSite) => currSite.siteUrl === `sc-domain:${domain}`,
              ) || null;

            if (!googleSite) {
              googleSite =
                googleSites.find(
                  (currSite) => stripTrailingSlash(currSite.siteUrl) === url,
                ) || null;
            }

            setSiteInfo({
              url,
              domain,
              custom: !domain.endsWith('.framer.app'),
              googleSite,
              currentPageUrl: publishInfo.production.currentPageUrl,
            });
          } else {
            setNeedsPublish(true);
          }
        }
      } catch (e) {
        showBoundary(e);
      }
    }

    update();
  }, [authContext.access_token, fetchGoogleSites, publishInfo, showBoundary]);

  if (SHOW_MOCK_SITEMAP_DATA) {
    return mockSiteInfo;
  }

  return { siteInfo, needsPublish };
}

interface AppLoadSiteProps {
  login: () => void;
  logout: () => void;
}

function AppLoadSite({ login, logout }: AppLoadSiteProps) {
  const site = usePublishedSite();

  if (site.needsPublish) {
    return <NeedsPublish login={login} />;
  }

  return !site.siteInfo ? (
    <Loading />
  ) : site.siteInfo && site.siteInfo.googleSite ? (
    <SiteView site={site.siteInfo as SiteWithGoogleSite} logout={logout} />
  ) : (
    <CriticalError site={site.siteInfo} logout={logout} />
  );
}

export function App() {
  const { login, logout, tokens, isReady, loading } = useGoogleToken();

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tokens?.access_token) {
      framer.showUI({ width: PLUGIN_WIDTH, height: SMALL_HEIGHT });
    } else {
      framer.showUI({ width: PLUGIN_WIDTH, height: LARGE_HEIGHT });
    }
  }, [tokens?.access_token]);

  return (
    <main key={tokens?.access_token || 'logout'} ref={ref}>
      <ErrorBoundary
        FallbackComponent={(e) => {
          return (
            <GoogleLogin
              loading={loading}
              hasError
              errorMessage={
                e.error.name !== 'GoogleError' ? e.error.message || '' : ''
              }
              login={login}
            />
          );
        }}
        resetKeys={[tokens?.access_token]}
      >
        <AuthContext.Provider value={tokens}>
          {isReady ? (
            tokens?.access_token ? (
              <AppLoadSite
                key={tokens.access_token}
                login={login}
                logout={logout}
              />
            ) : (
              <GoogleLogin login={login} loading={loading} />
            )
          ) : null}
        </AuthContext.Provider>
      </ErrorBoundary>
    </main>
  );
}
