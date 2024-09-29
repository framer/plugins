import { useState, useEffect } from "react"
import { Combobox, ComboboxInput, ComboboxOptions, ComboboxOption, ComboboxButton } from "@headlessui/react"
import cx from "classnames"
import { LANGUAGES } from "../constants"

interface Language {
    value: string
    label: string
    code: string
}

interface Props {
    language: Language
    onChange: (language: Language) => void
    className?: string
    disabled?: boolean
}

const LanguageCodeBadge = ({ language, className }: { language: Language; className?: string }) => (
    <div
        className={cx(
            "flex items-center justify-center w-4 h-4 bg-[#888888] rounded-sm drop-shadow-locale-code truncate",
            className
        )}
    >
        <p className="text-[8px] text-white dark:text-[#111111] font-bold">{language.code.toUpperCase()}</p>
    </div>
)

export const LanguageSelector = ({ language, onChange, className, disabled }: Props) => {
    const [query, setQuery] = useState(language.label)
    const [filteredLanguages, setFilteredLanguages] = useState<Language[]>(LANGUAGES)

    useEffect(() => {
        const filtered =
            query === ""
                ? LANGUAGES
                : LANGUAGES.filter(lang => {
                      const lowercaseQuery = query.toLowerCase()
                      const lowercaseLabel = lang.label.toLowerCase()

                      // Show all the languages when there's an exact match
                      if (lowercaseLabel === lowercaseQuery) {
                          return true
                      }

                      return lowercaseLabel.includes(lowercaseQuery)
                  })

        setFilteredLanguages(filtered)
    }, [query])

    return (
        <div className={cx("flex items-center rounded-lg", className)}>
            <Combobox
                value={language}
                disabled={disabled}
                onChange={(inputLanguage: Language | null) => {
                    if (inputLanguage) {
                        onChange(inputLanguage)
                    } else {
                        // Keep the currently selected language if the
                        // input is blank
                        onChange(language)
                    }
                }}
            >
                <div className="relative w-full">
                    <ComboboxButton as="div">
                        <ComboboxInput
                            aria-label="Language"
                            displayValue={(lang: Language) => lang.label}
                            onChange={e => setQuery(e.target.value)}
                            onFocus={() => setFilteredLanguages(LANGUAGES)}
                            className="w-full !pl-[31px]"
                        />
                    </ComboboxButton>
                    <div className="absolute left-2 top-1/2 transform -translate-y-1/2">
                        <LanguageCodeBadge language={language} />
                    </div>
                </div>
                {filteredLanguages.length > 0 && (
                    <ComboboxOptions
                        anchor="bottom"
                        className="mt-1 z-10 w-[var(--input-width)] px-[5px] rounded-[10px] shadow-lg combo-bg"
                    >
                        <div className="combo-bg w-full h-[5px] sticky top-0 z-20"></div>
                        <div className="max-h-[180px] overflow-y-auto no-scrollbar">
                            {filteredLanguages.map(lang => (
                                <ComboboxOption
                                    key={lang.value}
                                    value={lang}
                                    className={({ focus }) =>
                                        cx("cursor-pointer rounded-[5px] text-xs", {
                                            "bg-white dark:bg-tertiary": !focus,
                                            "bg-tint text-white": focus,
                                        })
                                    }
                                >
                                    {({ focus }) => (
                                        <div className="flex justify-between items-center w-full h-[26px] px-2.5">
                                            <span className="block overflow-hidden whitespace-nowrap text-ellipsis">
                                                {lang.label}
                                            </span>
                                            <span className={cx("ml-2", { "text-tertiary": !focus })}>{lang.code}</span>
                                        </div>
                                    )}
                                </ComboboxOption>
                            ))}
                        </div>
                        <div className="combo-bg w-full h-[5px] sticky bottom-0 z-20"></div>
                    </ComboboxOptions>
                )}
            </Combobox>
        </div>
    )
}
