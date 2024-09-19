import { framer, PublishInfo } from 'framer-plugin';
import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import './App.css';
import { GoogleSite, GoogleToken, Site, SiteWithGoogleSite } from './types';
import { googleApiCall, stripTrailingSlash } from './utils';
import GoogleLogin from './screens/GoogleLogin';
import { ErrorBoundary, useErrorBoundary } from 'react-error-boundary';
import { AuthContext, useGoogleToken } from './auth';
import CriticalError from './screens/CriticalError';
import SiteView from './screens/SiteView';
import Loading from './components/Loading';
import { useAutoSizer } from '@triozer/framer-toolbox';
import { ResizeContext } from './resize';
import { LARGE_HEIGHT, PLUGIN_WIDTH, SMALL_HEIGHT } from './constants';
import NeedsPublish from './screens/NeedsPublish';

framer.showUI({
  position: 'top right',
  width: PLUGIN_WIDTH,
  height: SMALL_HEIGHT,
  minWidth: PLUGIN_WIDTH,
  minHeight: SMALL_HEIGHT,
});

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
      try {
        if (publishInfo) {
          if (publishInfo.production?.url) {
            const domain = new URL(publishInfo.production.url).hostname;

            const googleSites = await fetchGoogleSites(
              authContext.access_token,
            );

            const url = stripTrailingSlash(publishInfo.production.url);

            const googleSite =
              googleSites.find(
                (currSite) =>
                  stripTrailingSlash(currSite.siteUrl) === url ||
                  currSite.siteUrl === `sc-domain:${domain}`,
              ) || null;

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
    <CriticalError site={site.siteInfo} />
  );
}

export function App() {
  const { login, logout, tokens, isReady, loading } = useGoogleToken();

  const ref = useRef<HTMLDivElement>(null)
  const { updatePluginDimensions } = useAutoSizer({
    enabled: false,
    options: {
      resizable: false,
      width: PLUGIN_WIDTH,
      height: SMALL_HEIGHT,
      minWidth: PLUGIN_WIDTH,
      minHeight: SMALL_HEIGHT,
    },
  });

  const resize = useCallback((height: 'short' | 'long') => {
    if (height === 'short') {
      updatePluginDimensions('manual', {
        width: PLUGIN_WIDTH,
        height: SMALL_HEIGHT,
      });
    } else {
      updatePluginDimensions('manual', {
        width: PLUGIN_WIDTH,
        height: LARGE_HEIGHT,
      });
    }
  }, []);

  useEffect(() => {
    if (!tokens?.access_token) {
      resize('short');
    }
  }, [resize, tokens?.access_token]);

  return (
    <ResizeContext.Provider value={resize}>
      <main key={tokens?.access_token || 'logout'} ref={ref}>
        <ErrorBoundary
          FallbackComponent={(e) => {
            // logout();

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
            {/* <button
          type="button"
          onClick={() => refresh(tokens?.refresh_token as string)}
        >
          Debug: Refresh token
        </button> */}
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
    </ResizeContext.Provider>
  );
}
