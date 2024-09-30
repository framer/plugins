/* eslint-disable @typescript-eslint/no-explicit-any */
import { useContext, useEffect, useState } from 'react';
import {
  GoogleInspectionResult,
  GoogleQueryResult,
  GoogleToken,
} from './types';
import { useErrorBoundary } from 'react-error-boundary';
import { batchGoogleApiCall, googleApiCall } from './utils';
import { AuthContext, useGoogleToken } from './auth';

interface GoogleInspectCall {
  apiPath: string;
  method: 'GET' | 'PUT' | 'POST';
  body: {
    inspectionUrl: string;
    siteUrl: string;
    languageCode: string;
  };
}

export function useBatchIndexingResult(
  urls: string[] | null,
  googleSiteUrl: string,
) {
  const authContext = useContext(AuthContext) as NonNullable<GoogleToken>;
  const [result, setResult] = useState<Record<
    string,
    GoogleInspectionResult
  > | null>(null);

  const { refresh } = useGoogleToken();

  useEffect(() => {
    batchGoogleApiCall<
      { inspectionResult: GoogleInspectionResult },
      GoogleInspectCall
    >(
      authContext.access_token,
      refresh,
      (urls || []).map((url) => ({
        apiPath: '/v1/urlInspection/index:inspect',
        method: 'POST',
        body: {
          inspectionUrl: url,
          siteUrl: googleSiteUrl,
          languageCode: window.navigator.language,
        },
      })),
    ).then((response) => {
      if (response) {
        const urlsWithStatus: Record<string, GoogleInspectionResult> = {};
        for (const responseUrl of response) {
          if (responseUrl) {
            urlsWithStatus[responseUrl.request.body.inspectionUrl] =
              responseUrl.response.inspectionResult;
          }
        }

        setResult(urlsWithStatus);
      }
    });
  }, [authContext.access_token, googleSiteUrl, refresh, urls]);

  return result;
}

export function useSingleIndexingResult(url: string, googleSiteUrl: string) {
  const authContext = useContext(AuthContext) as NonNullable<GoogleToken>;
  const [result, setResult] = useState<GoogleInspectionResult | null>(null);

  const { refresh } = useGoogleToken();

  useEffect(() => {
    googleApiCall<{ inspectionResult: GoogleInspectionResult }>(
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
    ).then((response) => {
      setResult(response.inspectionResult);
    });
  }, [authContext.access_token, googleSiteUrl, refresh, url]);

  return result;
}

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

function randomIntFromInterval(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function useMockPerformanceResults(): {
  dailyPerformance: GoogleQueryResult;
  queryPerformance: GoogleQueryResult;
} {
  const getRandomData = (): number[][] => {
    const savedData = window.localStorage.getItem(
      'searchConsoleRandomChartData',
    ) as string;

    if (savedData) {
      return JSON.parse(savedData);
    }

    const randomDataGen = [...new Array(14)].map(() => {
      const clicks = randomIntFromInterval(1000, 3000);
      const impressions = clicks + randomIntFromInterval(1000, 3000);

      return [clicks, impressions];
    });

    window.localStorage.setItem(
      'searchConsoleRandomChartData',
      JSON.stringify(randomDataGen),
    );

    return randomDataGen;
  };

  const randomData = getRandomData();

  const dailyPerformance = randomData.map((row, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);

    return {
      keys: [date.toISOString()],
      clicks: row[0] || 0,
      impressions: row[1] || 0,
      ctr: 0,
      position: 0,
    };
  });

  return {
    dailyPerformance: {
      responseAggregationType: 'byProperty',
      rows: dailyPerformance,
    },
    queryPerformance: {
      responseAggregationType: 'byProperty',
    },
  };
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
