import { CaretDownIcon, MoonIcon, SunIcon, SyncIcon } from "../../assets/icons/index.tsx"
import type { Theme } from "../../hooks/useTheme"

interface NavbarProps {
    url: string
    score?: number
    theme: Theme
    domains: string[]
    onDomainChange: (url: string) => void
    onAuditClick: () => void
    onToggleTheme: () => void
}

export function Navbar({ url, theme, domains, onDomainChange, onAuditClick, onToggleTheme }: NavbarProps) {
    const canSwitch = domains.length > 1
    return (
        <nav className="navbar">
            <div className="navbar-content">
                {canSwitch ? (
                    // Visible text + caret sit tightly together; the transparent
                    // native <select> overlays them so clicking anywhere on the
                    // domain opens the picker.
                    <div className="navbar-domain-switch">
                        <span className="navbar-url">{url}</span>
                        <CaretDownIcon className="navbar-domain-caret" />
                        <select
                            className="navbar-domain-select"
                            value={url}
                            onChange={e => {
                                onDomainChange(e.target.value)
                            }}
                            title="Switch the domain to analyze"
                            aria-label="Switch the domain to analyze"
                        >
                            {domains.map(d => (
                                <option key={d} value={d}>
                                    {d}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <span className="navbar-url">{url}</span>
                )}
                <button
                    className="navbar-theme-toggle"
                    onClick={onToggleTheme}
                    title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                    aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
                    {theme === "dark" ? <SunIcon /> : <MoonIcon />}
                </button>
            </div>

            <div className="navbar-actions">
                <button onClick={onAuditClick} className="navbar-button">
                    <SyncIcon />
                    RESCAN
                </button>
            </div>
        </nav>
    )
}
