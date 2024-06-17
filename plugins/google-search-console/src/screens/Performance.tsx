import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { GoogleQueryResult } from '../types';
import { mapQueries } from '../utils';
import { CSSProperties } from 'react';
import Loading from '../components/Loading';

function dateFormatter(value: number, long = false) {
  return new Date(value * 1000).toLocaleDateString(
    undefined,
    long
      ? { month: 'short', day: 'numeric', year: 'numeric' }
      : {
          month: 'short',
          day: 'numeric',
        },
  );
}

const roundFormatter = Intl.NumberFormat(undefined, { notation: 'compact' });

function valueRounderFormatter(value: number) {
  return roundFormatter.format(value);
}

interface PerformanceProps {
  siteUrl: string;
  performance: {
    dailyPerformance: GoogleQueryResult;
    queryPerformance: GoogleQueryResult;
  } | null;
}

interface QueriesTableProps {
  queries: GoogleQueryResult;
}

function QueriesTable({ queries }: QueriesTableProps) {
  const mappedQueries = mapQueries(queries);

  return (
    <table cellPadding={0} cellSpacing={0} className="performance-queries">
      {mappedQueries.map((query) => (
        <tr key={query.key} className="performance-query">
          <td>
            <div className="performance-query--key">
              {query.key}
              <div
                className="performance-query--progress"
                style={
                  { '--percent': `${query.percent * 100}%` } as CSSProperties
                }
              />
            </div>
          </td>
          <td className="performance-query--val">{query.val}</td>
        </tr>
      ))}
    </table>
  );
}

const mapPerfToChart = (performance: GoogleQueryResult) => {
  return (performance.rows || []).map((row) => {
    return {
      date: new Date(row.keys[0]).getTime() / 1000,
      clicks: row.clicks,
      impressions: row.impressions,
    };
  });
};

export default function Performance({
  siteUrl,
  performance,
}: PerformanceProps) {
  const chartData = performance?.dailyPerformance
    ? mapPerfToChart(performance.dailyPerformance)
    : [];

  if (!performance) {
    return <Loading />;
  }

  return (
    <div className="performance-sections">
      {performance?.dailyPerformance ? (
        <section>
          <div className="chart-offset">
            <ResponsiveContainer aspect={1.5}>
              <AreaChart
                margin={{ top: 5, left: 0, right: 5, bottom: 0 }}
                data={chartData}
              >
                <defs>
                  <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#09f" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#09f" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient
                    id="colorImpressions"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#ff00cc" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ff00cc" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  domain={['dataMin', 'dataMax']}
                  interval="equidistantPreserveStart"
                  tickLine={false}
                  scale="time"
                  type="number"
                  tickFormatter={(value: number) => dateFormatter(value)}
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={10}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  width={40}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={valueRounderFormatter}
                />
                <CartesianGrid vertical={false} />
                <Tooltip
                  labelFormatter={(value) =>
                    dateFormatter(value as number, true)
                  }
                  formatter={(value, type) => {
                    if (type === 'clicks') {
                      return [value.toLocaleString(), 'Clicks'];
                    }

                    if (type === 'impressions') {
                      return [value.toLocaleString(), 'Impressions'];
                    }

                    return [value.toLocaleString(), type];
                  }}
                />
                <Area
                  isAnimationActive={false}
                  type="linear"
                  dataKey="clicks"
                  stroke="#09f"
                  fillOpacity={1}
                  fill="url(#colorPv)"
                />
                <Area
                  isAnimationActive={false}
                  type="linear"
                  dataKey="impressions"
                  stroke="#ff00cc"
                  fillOpacity={1}
                  fill="url(#colorImpressions)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}
      {performance?.queryPerformance ? (
        <section>
          <div className="section-title">Top Queries</div>
          <QueriesTable queries={performance.queryPerformance} />
        </section>
      ) : null}
      <section>
        <button
          type="button"
          onClick={() => {
            window.open(
              `https://search.google.com/search-console/inspect?resource_id=${siteUrl}`,
              '_blank',
            );
          }}
        >
          Open Dashboard
        </button>
      </section>
    </div>
  );
}
