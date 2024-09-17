/* eslint-disable @typescript-eslint/no-explicit-any */
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { GoogleQueryResult } from '../types';
import { mapQueries } from '../utils';
import { CSSProperties, useMemo } from 'react';
import Loading from '../components/Loading';
import shortNumber from '@pogix3m/short-number';

function dateFormatter(value: number) {
  const date = new Date(value * 1000);

  return `${date.toLocaleDateString('en', { day: '2-digit' })}/${date.toLocaleDateString('en', { month: '2-digit' })}`;
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

const CustomYAxisTick = ({
  x,
  y,
  payload,
}: {
  x: any;
  y: any;
  payload: any;
}) => {
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} textAnchor="start" fill="#666">
        {dateFormatter(payload.value)}
      </text>
    </g>
  );
};

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

const randomDataGen = [...new Array(30)].map(() => {
  return [Math.round(Math.random() * 1500), Math.round(Math.random() * 1500)];
});

let randomData = [];

try {
  const savedData = window.localStorage.getItem('chartData') as string;
  randomData = savedData ? JSON.parse(savedData) : randomDataGen;

  if (!savedData) {
    window.localStorage.setItem('chartData', JSON.stringify(randomDataGen));
  }
} catch (e) {
  console.log('Chart error', e);
}

// Change this to true to show randomised chart data for testing.
const SHOW_RANDOM_CHART_DATA = false;

const mapPerfToChart = (performance: GoogleQueryResult) => {
  return (performance.rows || []).map((row, index) => {
    if (SHOW_RANDOM_CHART_DATA) {
      return {
        date: new Date(row.keys[0]).getTime() / 1000,
        clicks: randomData?.[index]?.[0] || 0,
        impressions: randomData?.[index]?.[1] || 0,
      };
    }

    return {
      date: new Date(row.keys[0]).getTime() / 1000,
      clicks: row.clicks,
      impressions: row.impressions,
    };
  });
};

const uppercase = (str: string) => {
  return `${str.slice(0, 1).toLocaleUpperCase()}${str.slice(1)}`;
};

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active: any;
  payload: any;
  label: any;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip-wrapper">
        <p className="chart-tooltip-label">{dateFormatter(label as number)}</p>
        <div>
          {[...payload].reverse().map((pld) => (
            <div className={`chart-tooltip--${pld.dataKey}`}>
              {uppercase(pld.dataKey)}: {pld.value}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
};

const lineType = 'monotone';

export default function Performance({ performance }: PerformanceProps) {
  const chartData = useMemo(
    () =>
      performance?.dailyPerformance
        ? mapPerfToChart(performance.dailyPerformance)
        : [],
    [performance?.dailyPerformance],
  );

  const totalClicks = useMemo(
    () =>
      chartData.reduce((acc, curr) => {
        return acc + curr.clicks;
      }, 0),
    [chartData],
  );

  const totalImpressions = useMemo(
    () =>
      chartData.reduce((acc, curr) => {
        return acc + curr.impressions;
      }, 0),
    [chartData],
  );

  if (!performance) {
    return <Loading />;
  }

  const emptyPerformance = chartData.every(
    (entry) => entry.clicks === 0 && entry.impressions === 0,
  );

  return (
    <>
      {emptyPerformance ? (
        <section>
          <p>Your site doesn’t have enough performance data to show yet.</p>
        </section>
      ) : performance?.dailyPerformance ? (
        <section>
          <div className="stat-boxes">
            <div className="stat-box--clicks">
              <div>{shortNumber(totalClicks)}</div>
              <div>{`Click${totalClicks === 1 ? '' : 's'}`}</div>
            </div>
            <div className="stat-box--impressions">
              <div>{shortNumber(totalImpressions)}</div>
              <div>{`Impression${totalImpressions === 1 ? '' : 's'}`}</div>
            </div>
          </div>
          <div className="chart-offset">
            <div className="responsive-5">
              <ResponsiveContainer aspect={1.5}>
                <AreaChart
                  margin={{ top: 10, left: 5, right: 5, bottom: 0 }}
                  data={chartData}
                >
                  <defs>
                    <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#0099FF"
                        stopOpacity={0.15}
                      />
                      <stop offset="95%" stopColor="#0099FF" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="colorImpressions"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#8855FF"
                        stopOpacity={0.15}
                      />
                      <stop offset="95%" stopColor="#8855FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    domain={['dataMin', 'dataMax']}
                    interval="equidistantPreserveStart"
                    tickLine={false}
                    tick={CustomYAxisTick}
                    scale="time"
                    type="number"
                    tickFormatter={(value: number) => dateFormatter(value)}
                    axisLine={false}
                    tickMargin={10}
                    minTickGap={10}
                  />
                  <Tooltip
                    // @ts-expect-error Props are added to component clone
                    content={<CustomTooltip />}
                    cursor={false}
                    wrapperClassName="chart-tooltip-wrapper"
                    labelFormatter={(value) => dateFormatter(value as number)}
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
                    type={lineType}
                    dataKey="clicks"
                    stroke="#0099FF"
                    fillOpacity={1}
                    fill="url(#colorPv)"
                  />
                  <Area
                    isAnimationActive={false}
                    type={lineType}
                    dataKey="impressions"
                    stroke="#8855FF"
                    fillOpacity={1}
                    fill="url(#colorImpressions)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      ) : null}
      {performance?.queryPerformance?.rows?.length ? (
        <section>
          <div className="section-title">Top Queries</div>
          <QueriesTable queries={performance.queryPerformance} />
        </section>
      ) : null}
    </>
  );
}
