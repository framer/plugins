export interface GoogleToken {
  access_token: string;
  expires_in: number;
  id_token: string;
  scope: string;
  token_type: string;
  refresh_token?: string;
}

export interface GoogleSite {
  siteUrl: string;
  permissionLevel: string;
}

export interface Site {
  url: string;
  domain: string;
  custom: boolean;
  googleSite: GoogleSite | null;
  currentPageUrl?: string;
}

export interface SiteWithGoogleSite extends Site {
  googleSite: GoogleSite;
}

export interface GoogleSitemapContent {
  type: string;
  submitted: string;
  indexed: string;
}

export interface GoogleSitemap {
  contents: GoogleSitemapContent[];
  path: string;
  isPending: boolean;
  isSitemapsIndex: boolean;
  warnings: string;
  errors: string;
}

export interface GoogleInspectionResult {
  indexStatusResult: {
    verdict: 'VERDICT_UNSPECIFIED' | 'PASS' | 'FAIL' | 'NEUTRAL';
    coverageState: string;
  };
  inspectionResultLink: string;
}

export interface GoogleQueryResult {
  responseAggregationType: 'byProperty';
  rows?: Array<{
    clicks: number;
    ctr: number;
    impressions: number;
    keys: string[];
    position: number;
  }>;
}
