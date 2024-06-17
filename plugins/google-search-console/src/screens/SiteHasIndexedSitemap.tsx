import { Fragment, useEffect, useMemo, useState } from 'react';
import sitemapper from 'sitemap-urls';
import { useErrorBoundary } from 'react-error-boundary';
import { GoogleInspectionResult, SiteWithGoogleSite } from '../types';
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  HelpCircle,
  XCircle,
} from 'react-feather';
import { useIndexingResults, usePerformanceResults } from '../hooks';
import Performance from './Performance';
import { getDateRange } from '../utils';
import Loading from '../components/Loading';

const VERDICT_ORDER = [
  'FAIL',
  'NEUTRAL',
  'VERDICT_UNSPECIFIED',
  'PASS',
] as const;

const VERDICT_LABELS = {
  FAIL: () => (
    <div className="group-fail">
      <XCircle />
      <span>Index failed</span>
    </div>
  ),
  NEUTRAL: () => (
    <div className="group-warn">
      <AlertCircle />
      <span>Not indexed</span>
    </div>
  ),
  VERDICT_UNSPECIFIED: () => (
    <div className="group-warn">
      <HelpCircle />
      <span>Status unknown</span>
    </div>
  ),
  PASS: () => (
    <div className="group-success">
      <CheckCircle />
      <span>Indexed</span>
    </div>
  ),
};

interface URLRowProps {
  url: string;
  inspection: GoogleInspectionResult;
}

function URLRow({ url, inspection }: URLRowProps) {
  const urlObject = new URL(url);
  const formattedUrl = url.slice(
    url.indexOf(urlObject.hostname) + urlObject.hostname.length,
  );

  const row = (
    <div className="url-inner">
      <div className="url-title-row">
        <div className="url-path">{formattedUrl}</div>
        <ExternalLink />
      </div>
      <div className="url-status">
        {inspection.indexStatusResult.coverageState}
      </div>
    </div>
  );

  return (
    <div className="url">
      {inspection.inspectionResultLink ? (
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
}

interface URLStatusesProps {
  urls: string[] | null;
  currentPageUrl?: string;
  indexingResult: ReturnType<typeof useIndexingResults>;
}

function URLStatuses({
  indexingResult,
  urls,
  currentPageUrl,
}: URLStatusesProps) {
  const { result, currPageResult } = indexingResult;

  const groups = useMemo(
    () =>
      result.results?.reduce(
        (acc, curr) => {
          if (!acc[curr.inspection.indexStatusResult.verdict]) {
            acc[curr.inspection.indexStatusResult.verdict] = [];
          }

          acc[curr.inspection.indexStatusResult.verdict].push(curr);

          return acc;
        },
        {} as Record<
          GoogleInspectionResult['indexStatusResult']['verdict'],
          { url: string; inspection: GoogleInspectionResult }[]
        >,
      ),
    [result.results],
  );

  if (!urls) {
    return <Loading />;
  }

  return (
    <div className="groups">
      <div className="groups">
        {/* {currentPageUrl || groups ? <ReIndexButton urls={urls} /> : null} */}
        {currentPageUrl ? (
          <div className="pages-section">
            <div className="pages-section-title">Current page</div>
            {currPageResult ? (
              <div>
                <div className="group-header">
                  {VERDICT_LABELS[
                    currPageResult.inspection.indexStatusResult.verdict
                  ]()}
                  <div className="group-header--border"></div>
                  <div className="group-header--border"></div>
                </div>
                <div className="urls">
                  <URLRow
                    url={currPageResult.url}
                    inspection={currPageResult.inspection}
                  />
                </div>
              </div>
            ) : (
              <Loading />
            )}
          </div>
        ) : null}
      </div>
      <div>
        <div className="pages-section-title">All pages</div>
        <div className="groups">
          {groups ? (
            VERDICT_ORDER.map((verdict) => (
              <Fragment key={verdict}>
                {groups[verdict] ? (
                  <div>
                    <div className="group-header">
                      {VERDICT_LABELS[verdict]()}
                      <div className="group-header--border"></div>
                      <div className="group-header--border"></div>
                    </div>
                    <div className="urls">
                      {groups[verdict]?.map((item) => (
                        <URLRow
                          key={item.url}
                          url={item.url}
                          inspection={item.inspection}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </Fragment>
            ))
          ) : (
            <Loading />
          )}
        </div>
      </div>
    </div>
  );
}

const dates = getDateRange(14);

export default function SiteHasIndexedSitemap({
  site,
}: SiteHasIndexedSitemapProps) {
  const { showBoundary } = useErrorBoundary();

  const [urls, setUrls] = useState<string[] | null>(null);

  useEffect(() => {
    async function update() {
      const sitemapResult = await fetch(
        `https://cors.farpace.workers.dev/${site.domain}/sitemap.xml`,
      );
      const sitemapText = await sitemapResult.text();

      const extracted = await sitemapper.extractUrls(sitemapText);

      setUrls([...new Set(extracted)].sort());
    }

    try {
      update();
    } catch (e) {
      showBoundary(e);
    }
  }, [showBoundary, site.domain]);

  const [currentTab, setCurrentTab] = useState<'performance' | 'indexing'>(
    'performance',
  );

  const indexingResult = useIndexingResults(
    urls,
    site.currentPageUrl,
    site.googleSite.siteUrl,
  );

  const performance = usePerformanceResults(site.googleSite.siteUrl, dates);

  if (site.googleSite) {
    return (
      <div>
        <nav className="tabs-nav">
          <button
            className={currentTab === 'performance' ? 'tabs-nav--active' : ''}
            type="button"
            onClick={() => setCurrentTab('performance')}
          >
            Performance
          </button>
          <button
            className={currentTab === 'indexing' ? 'tabs-nav--active' : ''}
            type="button"
            onClick={() => setCurrentTab('indexing')}
          >
            Indexing
          </button>
        </nav>
        <section>
          {currentTab === 'indexing' ? (
            <URLStatuses
              indexingResult={indexingResult}
              currentPageUrl={site.currentPageUrl}
              urls={urls}
            />
          ) : (
            <Performance
              siteUrl={site.googleSite.siteUrl}
              performance={performance}
            />
          )}
        </section>
      </div>
    );
  }

  return null;
}
