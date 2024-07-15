import { getLocalStorageTokens } from './auth';
import { GoogleError } from './errors';
import { GoogleQueryResult, GoogleToken } from './types';

export function sitemapUrl(siteUrl: string) {
  const fullUrl = new URL(siteUrl);
  fullUrl.pathname = '/sitemap.xml';

  return fullUrl.toString();
}

export function stripTrailingSlash(str: string) {
  return str.endsWith('/') ? str.slice(0, str.length - 1) : str;
}

export async function googleApiCall<T>(
  path: string,
  token: string,
  refresh: () => Promise<GoogleToken | null>,
  opts: {
    method?: 'GET' | 'PUT' | 'POST';
    body?: BodyInit;
  } = { method: 'GET' },
): Promise<T> {
  const initialToken = getLocalStorageTokens();

  const attempt = async (currToken: string) =>
    await fetch(`https://searchconsole.googleapis.com${path}`, {
      headers: {
        Authorization: `Bearer ${currToken}`,
        Accept: 'application/json',
      },
      ...(opts.method !== 'GET' ? opts : {}),
    });

  let result = await attempt(initialToken?.access_token || token);

  if (!result.ok) {
    const newToken = await refresh();

    if (newToken) {
      result = await attempt(newToken.access_token);
    }
  }

  if (!result.ok) {
    throw new GoogleError('API call error');
  }

  try {
    const json = await result.json();

    return json;
  } catch (e) {
    return null as unknown as T;
  }
}

export function getDateRange(range: number) {
  const today = new Date();

  const dates = [today];
  for (let i = 1; i < range; i++) {
    dates.push(new Date(new Date(today).setDate(today.getDate() - i)));
  }

  return dates.map((date) => date.toISOString().split('T', 1)[0]);
}

export function mapQueries(queries: GoogleQueryResult) {
  if (!queries.rows) {
    return [];
  }

  const mapped = queries.rows.map((query) => ({
    key: query.keys[0],
    val: query.clicks,
  }));

  const maxVal = Math.max(...mapped.map((item) => item.val));

  return mapped.map((item) => ({
    ...item,
    percent: item.val / maxVal || 0,
  }));
}
