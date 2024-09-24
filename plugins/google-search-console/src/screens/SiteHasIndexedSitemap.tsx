import { useContext, useEffect, useState } from 'react';
import sitemapper from 'sitemap-urls';
import { useErrorBoundary } from 'react-error-boundary';
import { GoogleInspectionResult, SiteWithGoogleSite } from '../types';
import {
  useMockPerformanceResults,
  usePerformanceResults,
  useSingleIndexingResult,
} from '../hooks';
import Performance from './Performance';
import { getDateRange } from '../utils';
import Loading from '../components/Loading';
import { ResizeContext } from '../resize';
import doc from '../images/Doc.svg';
import indexNone from '../images/IndexNone.svg';
import indexAdded from '../images/IndexAdded.svg';
import InlineSpinner from '../components/InlineSpinner';
import { mockUrls } from '../mocks';

interface URLRowProps {
  url: string;
  googleSiteUrl: string;
}

// Change this to true to show mock sitemap data for testing.
const SHOW_MOCK_SITEMAP_DATA = !!import.meta.env.VITE_MOCK_DATA;

function useMockIndexingResult(url: string): GoogleInspectionResult {
  return {
    indexStatusResult: {
      verdict: url === 'https://benframer.lionfeet.com/' ? 'PASS' : 'NEUTRAL',
    },
    inspectionResultLink: '#',
  };
}

const useIndexingResult = SHOW_MOCK_SITEMAP_DATA
  ? useMockIndexingResult
  : useSingleIndexingResult;

function URLRow({ url, googleSiteUrl }: URLRowProps) {
  const urlObject = new URL(url);
  const formattedUrl = url.slice(
    url.indexOf(urlObject.hostname) + urlObject.hostname.length,
  );
  const friendlyUrl = formattedUrl === '/' ? 'Home' : formattedUrl;

  const inspection = useIndexingResult(url, googleSiteUrl);

  const row = (
    <div className="url-inner">
      <div className="url-title-row">
        <img src={doc} alt="" width="12" height="12" />
        <div className="url-path">{friendlyUrl}</div>
        <div className="url-status-icon">
          {inspection ? (
            <img
              src={
                inspection.indexStatusResult.verdict === 'PASS'
                  ? indexAdded
                  : indexNone
              }
              alt={
                inspection.indexStatusResult.verdict === 'PASS'
                  ? 'Indexed'
                  : 'Not indexed'
              }
              width={16}
              height={16}
            />
          ) : (
            <InlineSpinner />
          )}
        </div>
        <div className="url-inspect">Inspect</div>
      </div>
    </div>
  );

  return (
    <div className="url">
      {inspection && inspection.inspectionResultLink ? (
        <a
          href={inspection.inspectionResultLink}
          target="_blank"
          rel="noopener"
        >
          {row}
        </a>
      ) : (
        row
      )}
    </div>
  );
}

interface SiteHasIndexedSitemapProps {
  site: SiteWithGoogleSite;
  logout: () => void;
}

interface URLStatusesProps {
  urls: string[] | null;
  googleSiteUrl: string;
}

function URLStatuses({ urls, googleSiteUrl }: URLStatusesProps) {
  return (
    <div className="groups">
      <div>
        <div className="pages-section-title">Indexing</div>
        <div className="urls-list">
          {urls ? (
            urls.map((result) => (
              <URLRow key={result} url={result} googleSiteUrl={googleSiteUrl} />
            ))
          ) : (
            <Loading inline />
          )}
        </div>
      </div>
    </div>
  );
}

const dates = getDateRange(14);

const usePerformanceResultsHook = SHOW_MOCK_SITEMAP_DATA
  ? useMockPerformanceResults
  : usePerformanceResults;

export default function SiteHasIndexedSitemap({
  site,
  logout,
}: SiteHasIndexedSitemapProps) {
  const { showBoundary } = useErrorBoundary();

  const [urls, setUrls] = useState<string[] | null>(null);

  useEffect(() => {
    async function update() {
      if (SHOW_MOCK_SITEMAP_DATA) {
        setUrls([...new Set(mockUrls)].sort());
      } else {
        const sitemapResult = await fetch(
          `https://cors.farpace.workers.dev/${site.domain}/sitemap.xml`,
        );
        const sitemapText = await sitemapResult.text();

        const extracted = await sitemapper.extractUrls(sitemapText);

        setUrls([...new Set(extracted)].sort());
      }
    }

    try {
      update();
    } catch (e) {
      showBoundary(e);
    }
  }, [showBoundary, site.domain]);

  const performance = usePerformanceResultsHook(site.googleSite.siteUrl, dates);

  const resize = useContext(ResizeContext);

  useEffect(() => {
    if (resize && performance) {
      resize('long');
    }
  }, [resize, performance]);

  if (site.googleSite) {
    return (
      <div className="in-app">
        <Performance
          siteUrl={site.googleSite.siteUrl}
          performance={performance}
        />
        <section>
          <URLStatuses urls={urls} googleSiteUrl={site.googleSite.siteUrl} />
        </section>
        <section className="actions-footer">
          <button type="button" onClick={logout}>
            Log Out
          </button>
          <button
            type="button"
            className="framer-button-primary"
            onClick={() => {
              window.open(
                `https://search.google.com/search-console/inspect?resource_id=${site.url}`,
                '_blank',
              );
            }}
          >
            Dashboard
          </button>
        </section>
      </div>
    );
  }

  return null;
}
