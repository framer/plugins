import { useEffect, useState, useCallback } from "react"
import { useInView } from "react-intersection-observer"
import { Area, AreaChart } from "recharts"
import { useDarkMode } from "usehooks-ts"
import { SEMRUSH_DATABASES } from "@/constants"
import { useInfiniteKeywordSearchQuery } from "@/api"
import { Columns, KeywordSearchSort, KeyphraseSearchType as SearchType } from "@/semrush"
import { Spinner } from "../components/Spinner"
import cx from "classnames"
import { TableBody, TableCell, TableContainer, TableHead, TableRow } from "@/components/Table"
import { DownArrowIcon } from "@/components/Icons"

type KeywordSearchArgs = Parameters<typeof useInfiniteKeywordSearchQuery>[0]

export function KeywordsSearchPage() {
    const { ref: scrollRef, inView } = useInView()
    const [keyword, setKeyword] = useState("")
    const debouncedKeyword = useDebounce(keyword, 500)
    const [searchOptions, setSearchOptions] = useState<KeywordSearchArgs>({
        keyword: debouncedKeyword,
        database: "us",
        type: "phrase_related",
        sort: { column: Columns.searchVolume, order: "desc" },
        limit: 16,
    })
    const { fetchNextPage, hasNextPage, isFetchingNextPage, data, isLoading, isPlaceholderData, isFetching } =
        useInfiniteKeywordSearchQuery({
            ...searchOptions,
            keyword: debouncedKeyword,
            limit: 16,
        })

    useEffect(() => {
        if (inView) {
            fetchNextPage()
        }
    }, [inView, fetchNextPage])

    const handleSort = useCallback(
        (newColumn: Columns) => {
            const currentSort = searchOptions.sort
            let newOrder: KeywordSearchSort["order"] = "desc"

            // Flip sort order if column already sorted
            if (currentSort.column === newColumn) {
                newOrder = currentSort.order === "asc" ? "desc" : "asc"
            }

            setSearchOptions(prevOptions => ({
                ...prevOptions,
                sort: { column: newColumn, order: newOrder },
            }))
        },
        [searchOptions.sort]
    )

    return (
        <div className="col-lg w-[700px]">
            <div className="row justify-between">
                <div className="row items-center">
                    <input
                        type="text"
                        placeholder="e.g. pizza place, movies"
                        className="w-[200px]"
                        onChange={e => setKeyword(e.target.value)}
                        value={keyword}
                    />
                    <p>in:</p>
                    <select
                        name="database"
                        onChange={e =>
                            setSearchOptions(prevOptions => ({
                                ...prevOptions,
                                database: e.target.value,
                            }))
                        }
                    >
                        {SEMRUSH_DATABASES.map((db, i) => (
                            <option value={db.value} key={i}>
                                {db.title}
                            </option>
                        ))}
                    </select>
                </div>
                <select
                    name="searchType"
                    onChange={e =>
                        setSearchOptions(prevOptions => ({
                            ...prevOptions,
                            type: e.target.value as SearchType,
                        }))
                    }
                >
                    <option value="phrase_related">Related</option>
                    <option value="phrase_fullsearch">Full Search</option>
                    <option value="phrase_questions">Questions</option>
                </select>
            </div>
            <div className="flex items-center justify-center h-[545px] relative">
                {isLoading && <Spinner size="large" inheritColor />}
                {isPlaceholderData && isFetching && (
                    <div className="w-full h-full flex items-center justify-center absolute top-8 right-3">
                        <div className="w-full h-full absolute backdrop-blur-[2px] z-10"></div>
                        <Spinner size="large" inheritColor className="z-20 ml-3" />
                    </div>
                )}
                {!isLoading && (data === undefined || keyword === "") && (
                    <p className="text-tertiary text-center max-w-[300px]">
                        Find new ranking opportunities in just a few clicks with a database of 25 billion keywords.
                    </p>
                )}
                {data?.length === 0 && keyword && <p className="text-tertiary">Nothing returned.</p>}
                {data && data.length > 0 && keyword && (
                    <TableContainer className="self-start">
                        <TableHead className="pr-4">
                            {columnHeadings.map(({ sortColumn, className, name }, i) => {
                                const { column, order } = searchOptions.sort

                                return (
                                    <TableCell
                                        key={i}
                                        className={cx(className, {
                                            "cursor-pointer": sortColumn,
                                        })}
                                        onClick={sortColumn ? () => handleSort(sortColumn) : undefined}
                                    >
                                        <p>{name}</p>
                                        {column === sortColumn ? (
                                            order === "asc" ? (
                                                <DownArrowIcon />
                                            ) : (
                                                <div className="rotate-180">
                                                    <DownArrowIcon />
                                                </div>
                                            )
                                        ) : null}
                                    </TableCell>
                                )
                            })}
                        </TableHead>
                        <TableBody>
                            {data.map((row, i) => (
                                <KeywordRow key={i} row={row} database={searchOptions.database} />
                            ))}
                            <div ref={scrollRef}></div>
                            {!hasNextPage && (
                                <p className="text-tertiary w-full text-center mb-15">
                                    You have reached the end of the list.
                                </p>
                            )}
                            {isFetchingNextPage && (
                                <div className="flex justify-center items-center relative mb-15">
                                    <Spinner inheritColor={true} />
                                </div>
                            )}
                        </TableBody>
                    </TableContainer>
                )}
            </div>
        </div>
    )
}

type KeywordRow = NonNullable<ReturnType<typeof useInfiniteKeywordSearchQuery>["data"]>[0]

const KeywordRow = ({ row, database }: { row: KeywordRow; database: string }) => {
    const { isDarkMode } = useDarkMode()
    const { keyword, intentCodes, trends, cpc, totalResults, searchVolume, difficulty: keywordDifficulty } = row

    const difficulty = parseInt(keywordDifficulty)

    return (
        <TableRow className="min-h-[40px]">
            <TableCell className="grow">
                <a
                    target="_blank"
                    href={`https://semrush.com/analytics/keywordoverview/?q=${keyword}&db=${database}`}
                    className="line-clamp-2"
                >
                    {keyword}
                </a>
            </TableCell>
            <TableCell>
                {!intentCodes
                    ? "-"
                    : intentCodes.map((code, i) => (
                          <span
                              key={i}
                              className={cx(
                                  "font-semibold font-sans w-4 h-4 rounded-sm flex items-center justify-center",
                                  {
                                      "bg-[#FCE081] text-[#A75800]": code === "0",
                                      "bg-[#C4E5FE] text-[#006DCA]": code === "1",
                                      "bg-[#EDD9FF] text-[#8649E1]": code === "2",
                                      "bg-[#9EF2C9] text-[#007C65]": code === "3",
                                  }
                              )}
                          >
                              {["C", "I", "N", "T"][Number(code)]}
                          </span>
                      ))}
            </TableCell>
            <TableCell>{searchVolume}</TableCell>
            <TableCell>
                <AreaChart
                    width={51}
                    height={15}
                    data={trends.map(point => ({
                        value: parseFloat(point),
                    }))}
                    margin={{ top: 1, right: 0, left: 0, bottom: 2 }}
                >
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={"#0099FF"}
                        fill={isDarkMode ? "transparent" : "#EAF4FF"}
                    />
                </AreaChart>
            </TableCell>
            <TableCell>${cpc}</TableCell>
            <TableCell>{totalResults}</TableCell>
            <TableCell
                className={cx({
                    "text-framer-green": difficulty < 50,
                    "text-framer-yellow": difficulty >= 50 && difficulty < 70,
                    "text-framer-red": difficulty >= 70,
                })}
            >
                {difficulty}%
            </TableCell>
        </TableRow>
    )
}

const columnHeadings = [
    { name: "Keyword", className: "grow" },
    { name: "Intent" },
    {
        name: "Volume",
        sortColumn: Columns.searchVolume,
    },
    { name: "Trend" },
    { name: "CPC", sortColumn: Columns.cpc },
    { name: "Results", sortColumn: Columns.totalResults },
    { name: "Difficulty", sortColumn: Columns.difficulty },
]

function useDebounce<T>(value: T, delay: number) {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)

    useEffect(() => {
        const debounce = setTimeout(() => setDebouncedValue(value), delay)

        return () => {
            clearTimeout(debounce)
        }
    }, [value, delay])

    return debouncedValue
}
