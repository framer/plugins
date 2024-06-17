import { framer, PublishInfo } from 'framer-plugin';
import { useState, useEffect, useContext, useCallback } from 'react';
import './App.css';
import { GoogleSite, GoogleToken, Site, SiteWithGoogleSite } from './types';
import { googleApiCall, stripTrailingSlash } from './utils';
import GoogleLogin from './screens/GoogleLogin';
import { ErrorBoundary, useErrorBoundary } from 'react-error-boundary';
import { AuthContext, useGoogleToken } from './auth';
import CriticalError from './screens/CriticalError';
import SiteView from './screens/SiteView';
import Loading from './components/Loading';

framer.showUI({
  title: 'Google Search Console',
  position: 'top right',
  width: 300,
  height: 500,
});

function usePublishedSite() {
  const [publishInfo, setPublishInfo] = useState<PublishInfo | null>(null);
  const [siteInfo, setSiteInfo] = useState<Site>();
  const { showBoundary } = useErrorBoundary();

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
        if (publishInfo && publishInfo.production?.url) {
          const domain = new URL(publishInfo.production.url).hostname;

          const googleSites = await fetchGoogleSites(authContext.access_token);

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
        }
      } catch (e) {
        showBoundary(e);
      }
    }

    update();
  }, [authContext.access_token, fetchGoogleSites, publishInfo, showBoundary]);

  return siteInfo;
}

function AppLoadSite() {
  const site = usePublishedSite();

  return !site ? (
    <Loading />
  ) : site && site.googleSite ? (
    <SiteView site={site as SiteWithGoogleSite} />
  ) : (
    <CriticalError />
  );
}

export function App() {
  const { login, tokens, isReady } = useGoogleToken();

  return (
    <div key={tokens?.access_token || 'logout'}>
      <ErrorBoundary
        FallbackComponent={() => {
          // logout();

          return <GoogleLogin hasError login={login} />;
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
            <main>
              {tokens?.access_token ? (
                <AppLoadSite key={tokens.access_token} />
              ) : (
                <GoogleLogin login={login} />
              )}
            </main>
          ) : null}
        </AuthContext.Provider>
      </ErrorBoundary>
    </div>
  );
}
