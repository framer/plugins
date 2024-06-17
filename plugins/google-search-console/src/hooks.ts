import { useContext, useEffect, useState } from 'react';
import {
  GoogleInspectionResult,
  GoogleQueryResult,
  GoogleToken,
} from './types';
import { useErrorBoundary } from 'react-error-boundary';
import { googleApiCall } from './utils';
import { AuthContext, useGoogleToken } from './auth';

export function useIndexingResults(
  urls: string[] | null,
  currentPageUrl: string | undefined,
  googleSiteUrl?: string,
) {
  const { showBoundary } = useErrorBoundary();

  const authContext = useContext(AuthContext) as NonNullable<GoogleToken>;

  const [result, setResult] = useState<{
    progress: number;
    results: { url: string; inspection: GoogleInspectionResult }[] | null;
  }>({ progress: 0, results: null });

  const [currPageResult, setCurrPageResult] = useState<{
    url: string;
    inspection: GoogleInspectionResult;
  } | null>(null);

  const incrementProgress = () => {
    setResult((currResult) => ({
      ...currResult,
      progress: currResult.progress + 1,
    }));
  };

  const { refresh } = useGoogleToken();

  useEffect(() => {
    if (!googleSiteUrl) {
      return;
    }

    async function update() {
      setResult({ progress: 0, results: null });

      if (currentPageUrl) {
        googleApiCall<{ inspectionResult: any }>(
          '/v1/urlInspection/index:inspect',
          authContext.access_token,
          refresh,
          {
            method: 'POST',
            body: JSON.stringify({
              inspectionUrl: currentPageUrl,
              siteUrl: googleSiteUrl,
              languageCode: window.navigator.language,
            }),
          },
        ).then((currInspection) => {
          setCurrPageResult({
            url: currentPageUrl,
            inspection: currInspection?.inspectionResult,
          });
        });
      }

      const promises = (urls || []).map(async (url) => {
        const inspection = await googleApiCall<{ inspectionResult: any }>(
          '/v1/urlInspection/index:inspect',
          authContext.access_token,
          refresh,
          {
            method: 'POST',
            body: JSON.stringify({
              inspectionUrl: url,
              siteUrl: googleSiteUrl,
              languageCode: window.navigator.language,
            }),
          },
        );

        incrementProgress();

        return { url, inspection: inspection?.inspectionResult };
      });

      try {
        const results = await Promise.all(promises);
        setResult((currResult) => ({ progress: currResult.progress, results }));
      } catch (e) {
        showBoundary;
      }
    }

    update();
  }, [
    authContext.access_token,
    currentPageUrl,
    googleSiteUrl,
    refresh,
    showBoundary,
    urls,
  ]);

  return { currPageResult, result };
}

export function usePerformanceResults(siteUrl: string, dates: string[]) {
  const [data, setData] = useState<{
    dailyPerformance: GoogleQueryResult;
    queryPerformance: GoogleQueryResult;
  } | null>(null);

  const { showBoundary } = useErrorBoundary();

  const authContext = useContext(AuthContext) as NonNullable<GoogleToken>;

  const { refresh } = useGoogleToken();

  useEffect(() => {
    const update = async () => {
      try {
        const dailyPerformance = (await googleApiCall(
          `/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
          authContext.access_token,
          refresh,
          {
            method: 'POST',
            body: JSON.stringify({
              startDate: dates[dates.length - 1],
              endDate: dates[0],
              dimensions: ['date'],
            }),
          },
        )) as GoogleQueryResult;

        const queryPerformance = (await googleApiCall(
          `/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
          authContext.access_token,
          refresh,
          {
            method: 'POST',
            body: JSON.stringify({
              startDate: dates[dates.length - 1],
              endDate: dates[0],
              dimensions: ['query'],
              rowLimit: 5,
            }),
          },
        )) as GoogleQueryResult;

        setData({ dailyPerformance, queryPerformance });
      } catch (e) {
        showBoundary(e);
      }
    };

    update();
  }, [authContext.access_token, dates, refresh, showBoundary, siteUrl]);

  return data;
}
