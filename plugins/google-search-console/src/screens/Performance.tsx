import aveta from "aveta"
import { type CSSProperties, useMemo, useState } from "react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, type TooltipContentProps, XAxis } from "recharts"
import type { NameType, Payload, ValueType } from "recharts/types/component/DefaultTooltipContent"
import FitText from "../components/FitText"
import Loading from "../components/Loading"
import type { GoogleQueryResult } from "../types"
import { mapQueries } from "../utils"

function dateFormatter(value: number) {
    const date = new Date(value * 1000)

    return `${date.toLocaleDateString("en", { day: "2-digit" })}/${date.toLocaleDateString("en", { month: "2-digit" })}`
}

interface PerformanceProps {
    siteUrl: string
    performance: {
        dailyPerformance: GoogleQueryResult
        queryPerformance: GoogleQueryResult
    } | null
}

interface QueriesTableProps {
    queries: GoogleQueryResult
}

const CustomYAxisTick = ({ x, y, payload }: { x: number; y: number; payload: { value: number } }) => {
    return (
        <g transform={`translate(${x},${y})`}>
            <text x={0} y={0} textAnchor="start" fill="#666">
                {dateFormatter(payload.value)}
            </text>
        </g>
    )
}

function QueriesTable({ queries }: QueriesTableProps) {
    const mappedQueries = mapQueries(queries)

    return (
        <table cellPadding={0} cellSpacing={0} className="performance-queries">
            {mappedQueries.map(query => (
                <tr key={query.key} className="performance-query">
                    <td>
                        <div className="performance-query--key">
                            {query.key}
                            <div
                                className="performance-query--progress"
                                style={{ "--percent": `${query.percent * 100}%` } as CSSProperties}
                            />
                        </div>
                    </td>
                    <td className="performance-query--val">{query.val}</td>
                </tr>
            ))}
        </table>
    )
}

const mapPerfToChart = (performance: GoogleQueryResult) => {
    return (performance.rows ?? []).map(row => {
        return {
            date: new Date(row.keys[0] ?? "").getTime() / 1000,
            clicks: row.clicks,
            impressions: row.impressions,
        }
    })
}

const uppercase = (str: string) => {
    return `${str.slice(0, 1).toLocaleUpperCase()}${str.slice(1)}`
}

const CustomTooltip = ({
    active,
    payload,
    label,
}: Omit<TooltipContentProps<ValueType, NameType>, "payload"> & { payload: Payload<ValueType, NameType>[] }) => {
    if (!active) return null

    return (
        <div className="chart-tooltip-wrapper">
            <p className="chart-tooltip-label">{dateFormatter(label as number)}</p>
            <div>
                {payload.toReversed().map(pld => {
                    if (typeof pld.dataKey !== "string" || pld.value === undefined) {
                        throw new Error(`Bad custom tooltip payload: ${JSON.stringify(pld)}`)
                    }

                    return (
                        <div className={`chart-tooltip--${pld.dataKey}`}>
                            {uppercase(pld.dataKey)}: {pld.value.toLocaleString()}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

const lineType = "monotone"

export default function Performance({ performance }: PerformanceProps) {
    const chartData = useMemo(
        () => (performance?.dailyPerformance ? mapPerfToChart(performance.dailyPerformance) : []),
        [performance?.dailyPerformance]
    )

    const totalClicks = useMemo(
        () =>
            chartData.reduce((acc, curr) => {
                return acc + curr.clicks
            }, 0),
        [chartData]
    )

    const totalImpressions = useMemo(
        () =>
            chartData.reduce((acc, curr) => {
                return acc + curr.impressions
            }, 0),
        [chartData]
    )

    const [metricFocus, setMetricFocus] = useState<"clicks" | "impressions" | null>(null)

    if (!performance) {
        return <Loading />
    }

    const emptyPerformance = chartData.every(entry => entry.clicks === 0 && entry.impressions === 0)

    return (
        <>
            {emptyPerformance ? (
                <section>
                    <p>Your site doesn’t have enough performance data to show yet.</p>
                </section>
            ) : (
                <section>
                    <div className="stat-boxes">
                        <div
                            role="button"
                            className="stat-box--clicks"
                            style={{
                                opacity: metricFocus && metricFocus !== "clicks" ? 0.5 : 1,
                            }}
                            onClick={() => {
                                setMetricFocus(currFocus => (currFocus === "clicks" ? null : "clicks"))
                            }}
                        >
                            <div>
                                <FitText>{aveta(totalClicks)}</FitText>
                            </div>
                            <div>{`Click${totalClicks === 1 ? "" : "s"}`}</div>
                        </div>
                        <div
                            role="button"
                            className="stat-box--impressions"
                            style={{
                                opacity: metricFocus && metricFocus !== "impressions" ? 0.5 : 1,
                            }}
                            onClick={() => {
                                setMetricFocus(currFocus => (currFocus === "impressions" ? null : "impressions"))
                            }}
                        >
                            <div>
                                <FitText>{aveta(totalImpressions)}</FitText>
                            </div>
                            <div>{`Impression${totalImpressions === 1 ? "" : "s"}`}</div>
                        </div>
                    </div>
                    <div className="chart-offset">
                        <div className="responsive-5">
                            <ResponsiveContainer aspect={1.5}>
                                <AreaChart margin={{ top: 10, left: 5, right: 5, bottom: 0 }} data={chartData}>
                                    <defs>
                                        <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0099FF" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#0099FF" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8855FF" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#8855FF" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis
                                        dataKey="date"
                                        domain={["dataMin", "dataMax"]}
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
                                        content={CustomTooltip}
                                        cursor={false}
                                        wrapperClassName="chart-tooltip-wrapper"
                                        labelFormatter={value => dateFormatter(value as number)}
                                        formatter={(value, type) => {
                                            if (type === "clicks") {
                                                return [value.toLocaleString(), "Clicks"]
                                            }

                                            if (type === "impressions") {
                                                return [value.toLocaleString(), "Impressions"]
                                            }

                                            return [value.toLocaleString(), type]
                                        }}
                                    />
                                    {!metricFocus || metricFocus === "clicks" ? (
                                        <Area
                                            isAnimationActive={false}
                                            type={lineType}
                                            dataKey="clicks"
                                            stroke="#0099FF"
                                            fillOpacity={1}
                                            fill="url(#colorPv)"
                                        />
                                    ) : null}
                                    {!metricFocus || metricFocus === "impressions" ? (
                                        <Area
                                            isAnimationActive={false}
                                            type={lineType}
                                            dataKey="impressions"
                                            stroke="#8855FF"
                                            fillOpacity={1}
                                            fill="url(#colorImpressions)"
                                        />
                                    ) : null}
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </section>
            )}
            {performance.queryPerformance.rows?.length ? (
                <section>
                    <div className="section-title">Top Queries</div>
                    <QueriesTable queries={performance.queryPerformance} />
                </section>
            ) : null}
        </>
    )
}
